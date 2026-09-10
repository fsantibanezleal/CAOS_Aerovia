"""Executed input-degradation and topology-family holdout experiments."""
from pathlib import Path
import json
import numpy as np
import torch

from .io import write_json, utc_now
from .model import NetworkError
from .surrogate_data import METHODS, REGIMES, arrays, FACTOR_BOUNDS
from .surrogate_models import ExportedSurrogate
from .surrogate_train import load_model, train_one, runtime
from .surrogate_evaluate import score_arrays, aggregate_rows


def diagnostics(work, device="cuda", epochs=200, seed=20260910, resume=False):
    work=Path(work)
    runtime("cpu")
    networks=json.loads((work/"networks.json").read_text(encoding="utf-8"))
    evaluation=json.loads((work/"evaluation.json").read_text(encoding="utf-8"))
    degraded_rows=[]
    noise_levels=(0.,.05,.15,.30)
    for case_index,net in enumerate(networks):
        prepared=arrays(work,net["id"])
        with np.load(work/"dataset"/f"{net['id']}.test.npz",allow_pickle=False) as data:
            factors,q_ref,p_ref,speeds=(data[key][:64] for key in ("factors","flows","pressures","speeds"))
        # Same errors injected for both models. True physical labels remain unchanged.
        z=np.random.default_rng(seed+case_index*301+900001).standard_normal(factors.shape)
        for method in METHODS:
            key=net["id"] if method=="topology-mlp" else "shared"
            model,_=load_model(work/f"checkpoints/{method}/{key}.best.pt")
            wrapper=ExportedSurrogate(model,prepared).eval()
            for noise in noise_levels:
                noisy_factors=factors*np.exp(noise*z-.5*noise**2)
                outside=int(np.count_nonzero(np.any((noisy_factors<FACTOR_BOUNDS[0])|(noisy_factors>FACTOR_BOUNDS[1]),axis=1)))
                with torch.inference_mode():
                    raw,q,p=[value.numpy() for value in wrapper(torch.as_tensor(np.log(noisy_factors).astype(np.float32)))]
                scored=score_arrays(net,factors,raw,q,p,q_ref,p_ref,speeds)
                degraded_rows.append({"methodId":method,"networkId":net["id"],"noiseSigma":noise,"outsideDomain":outside,**scored})
    degradation=[]
    for method in METHODS:
        for noise in noise_levels:
            rows=[r for r in degraded_rows if r["methodId"]==method and r["noiseSigma"]==noise]
            aggregate=aggregate_rows(rows,method)
            degradation.append({**aggregate,"noiseSigma":noise,"outsideDomain":sum(r["outsideDomain"] for r in rows)})
    evaluation["degradation"]=degradation
    evaluation["degradationRows"]=degraded_rows
    evaluation["degradationProtocol"]={"formula":"observed R = true R * exp(sigma Z - sigma^2/2), Z standard normal; same noise for both models",
                                       "meaning":"synthetic multiplicative resistance-input error, not measured sensor performance", "seed":seed,
                                       "samplesPerCase":64,"trueLabelsUnchanged":True,"clippedInputs":False,
                                       "domainPolicy":"offline diagnostic deliberately evaluates extrapolation and counts it; live inference still refuses it"}
    write_json(work/"evaluation.json",evaluation)
    excluded=["room-pillar"]
    ids=[net["id"] for net in networks if net["id"] not in excluded]
    if not all(any(net["id"]==case for net in networks) for case in excluded):
        raise NetworkError("The topology holdout experiment requires the room-pillar case")
    training=train_one(work,"graph-surrogate",ids,device,epochs,256,seed+990001,resume,namespace="graph-family-holdout")
    runtime("cpu")
    model,_=load_model(work/training["checkpoint"])
    rows=[]
    for net in networks:
        if net["id"] not in excluded: continue
        prepared=arrays(work,net["id"])
        wrapper=ExportedSurrogate(model,prepared).eval()
        with np.load(work/"dataset"/f"{net['id']}.test.npz",allow_pickle=False) as data:
            factors,q_ref,p_ref,regimes,speeds=(data[key] for key in ("factors","flows","pressures","regimes","speeds"))
        with torch.inference_mode():
            raw,q,p=[value.numpy() for value in wrapper(torch.as_tensor(np.log(factors).astype(np.float32)))]
        for i,regime in enumerate(REGIMES):
            selected=regimes==i
            rows.append({"methodId":"graph-surrogate-family-holdout","networkId":net["id"],"regimeId":regime["id"],"split":"topology-family-test",
                         **score_arrays(net,factors[selected],raw[selected],q[selected],p[selected],q_ref[selected],p_ref[selected],speeds[selected])})
    evaluation["familyHoldout"]={"family":"room-and-pillar grid", "excludedCaseIds":excluded,"trainingCaseIds":ids,"metrics":rows,
                                "aggregate":aggregate_rows(rows,"graph-surrogate-family-holdout"),
                                "training":{k:v for k,v in training.items() if k!="history"},
                                "nominalCalibration":"the held-out network supplies one disclosed nominal physical calibration; no perturbed labels enter train or validation",
                                "mlpStatus":"unsupported: the topology-specific MLP has no pretrained output head for an excluded network",
                                "interpretation":"authored topology-family transfer stress test; no operational or unseen-mine guarantee; main live GNN is trained on all twelve known cases"}
    evaluation["diagnosticsCreatedAt"]=utc_now()
    write_json(work/"evaluation.json",evaluation)
    return {"schema":"aerovia.surrogate-diagnostics/v1","degradationCells":len(degraded_rows),"familyHoldoutCells":len(rows),"trainingSeconds":training["elapsedSeconds"]}
