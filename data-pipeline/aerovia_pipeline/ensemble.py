"""Batched resistance uncertainty with actual float64 CUDA linear algebra.

Draw generation is shared across devices. SciPy independently certifies a fixed
subset of the *identical* draws; matching seeds alone is not treated as parity.
"""
from time import perf_counter
import math
import numpy as np

from .model import assemble, solve, MASS_TOLERANCE, PRESSURE_TOLERANCE, NetworkError


def resistance_draws(resistance, samples, seed, cv):
    if not 8 <= samples <= 8192 or not 0 <= seed <= 2**32-1 or not 0 <= cv <= .75:
        raise NetworkError("Ensemble requires 8-8192 samples, a uint32 seed and CV in [0, .75]")
    sigma = math.sqrt(math.log1p(cv*cv))
    rng = np.random.default_rng(seed)
    return resistance[None, :] * np.exp(rng.standard_normal((samples, len(resistance)))*sigma - .5*sigma*sigma)


def batch_solve(model, resistance, baseline, device):
    """Damped Newton solves mixed conservation/branch equations, independently per draw."""
    started = perf_counter()
    q_scale, p_scale = model["qScale"], model["pScale"]
    m, n, samples = len(model["active"]), len(model["internal"]), len(resistance)
    z0 = np.concatenate((np.array(baseline["flows"])[model["active"]]/q_scale,
                         np.array(baseline["pressures"])[model["internal"]]/p_scale))
    if device == "cuda":
        import torch
        if not torch.cuda.is_available():
            raise NetworkError("CUDA requested but unavailable; install the CUDA requirements and verify the NVIDIA driver")
        dtype = torch.float64
        array = lambda value: torch.as_tensor(value, dtype=dtype, device="cuda")
        bi, forcing, effective = array(model["bi"]), array(model["forcing"]), array(resistance+model["k"])
        z = array(np.tile(z0, (samples,1)))
        eye_index = torch.arange(m, device="cuda")
        jac = torch.zeros((samples,m+n,m+n),device="cuda",dtype=dtype)
        jac[:,:n,:m], jac[:,n:,m:] = bi, bi.T

        def residual(v):
            q, p = v[:,:m]*q_scale, v[:,m:]*p_scale
            return torch.cat((q@bi.T/q_scale, (p@bi+forcing-effective*q*torch.abs(q))/p_scale),dim=1)

        failures = torch.zeros(samples, dtype=torch.bool, device="cuda")
        for iteration in range(1,81):
            residuals = residual(z)
            if torch.max(torch.abs(residuals)).item() < 2e-11:
                break
            jac[:,n+eye_index,eye_index] = -2*effective*torch.clamp(torch.abs(z[:,:m]*q_scale),min=1e-8)*q_scale/p_scale
            delta,info = torch.linalg.solve_ex(jac,-residuals.unsqueeze(-1))
            failures |= info != 0
            delta = torch.nan_to_num(delta.squeeze(-1),nan=0.,posinf=0.,neginf=0.)
            merit = torch.sum(residuals*residuals,dim=1)
            alpha = torch.ones(samples,device="cuda",dtype=dtype)
            for _ in range(24):
                trial = z+alpha[:,None]*delta
                rr = residual(trial)
                accept = torch.sum(rr*rr,dim=1) <= merit + 1e-26
                if torch.all(accept).item():
                    break
                alpha = torch.where(accept,alpha,alpha*.5)
            z += alpha[:,None]*delta
        torch.cuda.synchronize()
        output = z.cpu().numpy()
        fail_solve = failures.cpu().numpy()
        hardware = torch.cuda.get_device_name(0)
        backend = f"PyTorch {torch.__version__}; CUDA {torch.version.cuda}; float64"
    elif device == "cpu":
        bi,forcing,effective=model["bi"],model["forcing"],resistance+model["k"]
        z = np.tile(z0,(samples,1))
        jac = np.zeros((samples,m+n,m+n))
        jac[:,:n,:m], jac[:,n:,m:] = bi,bi.T
        index=np.arange(m)

        def residual(v):
            q,p=v[:,:m]*q_scale,v[:,m:]*p_scale
            return np.concatenate((q@bi.T/q_scale,(p@bi+forcing-effective*q*np.abs(q))/p_scale),axis=1)

        fail_solve = np.zeros(samples,dtype=bool)
        for iteration in range(1,81):
            residuals = residual(z)
            if np.max(np.abs(residuals),initial=0)<2e-11:
                break
            jac[:,n+index,index]=-2*effective*np.maximum(np.abs(z[:,:m]*q_scale),1e-8)*q_scale/p_scale
            try:
                delta=np.linalg.solve(jac,-residuals[...,None])[...,0]
            except np.linalg.LinAlgError:
                fail_solve[:]=True
                break
            merit=np.sum(residuals**2,axis=1)
            alpha=np.ones(samples)
            for _ in range(24):
                trial=z+alpha[:,None]*delta
                rr=residual(trial)
                accept=np.sum(rr*rr,axis=1)<=merit+1e-26
                if np.all(accept):
                    break
                alpha=np.where(accept,alpha,alpha*.5)
            z+=alpha[:,None]*delta
        output=z
        hardware="CPU"
        backend=f"NumPy {np.__version__}; float64"
    else:
        raise NetworkError("device must be cpu or cuda")
    q = output[:,:m]*q_scale
    p = np.tile(model["fixed"],(samples,1))
    p[:,model["internal"]] = output[:,m:]*p_scale
    mass = np.max(np.abs(q@model["bi"].T),axis=1,initial=0)
    closure = np.max(np.abs(p@model["b"]+model["h"]-(resistance+model["k"])*q*np.abs(q)),axis=1,initial=0)
    elapsed_ms=(perf_counter()-started)*1000
    return q,p,mass,closure,fail_solve,iteration,elapsed_ms,hardware,backend


def run_ensemble(network, baseline, samples=256, seed=20260909, cv=.15, device="cpu", options=None):
    options=options or {}
    model=assemble(network,options)
    if not model["active"]:
        raise NetworkError("Uncertainty requires at least one active airway")
    draws=resistance_draws(model["r"],samples,seed,cv)
    # Bound the dense Jacobian allocation independently of the requested draw count.
    # At the graph cap, 256 * 360² * 8 bytes is below 266 MiB before work buffers.
    batches=[batch_solve(model,draws[start:start+256],baseline,device) for start in range(0,samples,256)]
    q,p,mass,closure,failed_linear=[np.concatenate([batch[i] for batch in batches],axis=0) for i in range(5)]
    iterations=max(batch[5] for batch in batches)
    elapsed=sum(batch[6] for batch in batches)
    hardware,backend=batches[0][7],batches[0][8]
    fans=np.array(["fan" in network["edges"][i] for i in model["active"]])
    heads=model["h"]-model["k"]*q*np.abs(q)
    unsupported=np.any(fans & ((q < -1e-7)|(heads < -1e-6)),axis=1)
    accepted=(mass<=MASS_TOLERANCE)&(closure<=PRESSURE_TOLERANCE)&np.all(np.isfinite(q),axis=1)&~failed_linear&~unsupported
    failed_indices=np.flatnonzero(~accepted).tolist()
    q_full=np.zeros((samples,len(network["edges"])))
    q_full[:,model["active"]]=q
    powers=np.sum(np.where(fans,np.maximum(0,heads)*np.maximum(0,q)/model["efficiency"]/1000,0),axis=1)
    if not accepted.any():
        raise NetworkError(f"All {samples} ensemble samples failed residual or supported-fan checks")
    quantiles=np.quantile(q_full[accepted],[.05,.5,.95],axis=0)
    p_quantiles=np.quantile(powers[accepted],[.05,.5,.95])
    targets=np.array([options.get("overrides",{}).get(e["id"],{}).get("target",e["target"]) for e in network["edges"]])
    probability=np.mean(q_full[accepted]>=targets,axis=0)
    probability[targets<=0]=1
    parity,parity_fixtures=[],[]
    for index in sorted(set(np.linspace(0,samples-1,min(8,samples),dtype=int).tolist())):
        cpu=solve(network,options,resistance_draw=draws[index])
        if not cpu["converged"]:
            raise NetworkError(f"Independent SciPy parity solve failed for realization {index}")
        error=float(np.max(np.abs(q_full[index]-cpu["flows"]),initial=0))
        parity.append(error)
        overrides={e["id"]:{**options.get("overrides",{}).get(e["id"],{}),"resistance":float(draws[index,j]/options.get("resistanceScale",1))} for j,i in enumerate(model["active"]) for e in [network["edges"][i]]}
        for e_id,override in options.get("overrides",{}).items():
            if e_id not in overrides:
                overrides[e_id]=override
        parity_fixtures.append({"networkId":network["id"],"sampleIndex":index,"options":{**options,"overrides":overrides},"result":cpu,"batchMaxAbsFlow":error})
    summary={"schema":"aerovia.ensemble/v1","samples":samples,"acceptedSamples":int(accepted.sum()),"seed":seed,"cv":cv,
             "distribution":"independent lognormal resistance, mean equal to entered resistance; fan coefficient fixed",
             "device":device,"hardware":hardware,"backend":backend,"dtype":"float64","elapsedMs":elapsed,"iterations":iterations,"batchSize":min(samples,256),
             "flowP05":quantiles[0].tolist(),"flowP50":quantiles[1].tolist(),"flowP95":quantiles[2].tolist(),
             "targetProbability":probability.tolist(),"powerP05":float(p_quantiles[0]),"powerP50":float(p_quantiles[1]),"powerP95":float(p_quantiles[2]),
             "failures":len(failed_indices),"failedSampleIndices":failed_indices,"unsupportedFanSamples":int(unsupported.sum()),
             "maxMassResidual":float(np.max(mass,initial=0)),"maxPressureResidual":float(np.max(closure,initial=0)),
             "paritySamples":len(parity),"parityMaxAbsFlow":max(parity),"parityMethod":"SciPy independent mixed flow/pressure least_squares on identical saved draws"}
    return summary,parity_fixtures
