"""Scientific boundaries for optional learned lane; run in the pinned model environment."""
from copy import deepcopy
from pathlib import Path
import json
import sys
import numpy as np
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"data-pipeline"))
from aerovia_pipeline.cases import levels
from aerovia_pipeline.io import write_json
from aerovia_pipeline.model import solve
from aerovia_pipeline.surrogate_data import ingest, preprocess, arrays, draw_factors, domain_status, regime_options, REGIMES
from aerovia_pipeline.surrogate_evaluate import confusion_metrics, score_arrays


@pytest.fixture
def prepared(tmp_path):
    network = levels(count=2,bays=2)
    write_json(tmp_path / "source.json",[network])
    ingest(tmp_path / "source.json",tmp_path)
    preprocess(tmp_path)
    return network,arrays(tmp_path,network["id"]),tmp_path


def test_conservation_projector_is_identity_on_independent_reference(prepared):
    network,graph,_ = prepared
    reference = solve(network,{"resistanceScale":1.6})
    q = np.asarray(reference["flows"])
    assert np.max(np.abs(graph["bi"]@graph["projector"])) < 1e-12
    assert np.max(np.abs(graph["projector"]@graph["projector"]-graph["projector"])) < 1e-12
    assert np.max(np.abs(graph["projector"]@q-q)) < 1e-8


def test_pressure_reconstruction_matches_nonlinear_reference(prepared):
    network,graph,_ = prepared
    factor=1.6
    reference=solve(network,{"resistanceScale":factor})
    q=np.asarray(reference["flows"])
    p=graph["pressure_map"]@((graph["resistance"]*factor+graph["coefficient"])*q*np.abs(q)-graph["forcing"])
    assert np.max(np.abs(p-reference["pressures"]))<1e-7


def test_split_seeds_are_reproducible_and_disjoint(prepared):
    network,_,_=prepared
    a,classes,speeds=draw_factors(network,120,17)
    b,_,_=draw_factors(network,120,18)
    assert np.array_equal(a,draw_factors(network,120,17)[0])
    assert len(set(map(bytes,a)))==120
    assert not set(map(bytes,a)) & set(map(bytes,b))
    assert set(classes)==set(range(6))
    assert np.min(a)>=.35 and np.max(a)<=5.8


@pytest.mark.parametrize("change",["closure","fan","boundary","connectivity","extrapolation"])
def test_domain_rejects_actual_unsupported_state(prepared,change):
    network,_,_=prepared
    edited=deepcopy(network)
    options={}
    if change=="closure": options={"overrides":{edited["edges"][0]["id"]:{"closed":True}}}
    elif change=="fan": edited["edges"][0]["fan"]["pressure"]+=1
    elif change=="boundary": edited["nodes"][0]["boundary"]=20
    elif change=="connectivity": edited["edges"][1]["from"]=edited["nodes"][-1]["id"]
    elif change=="extrapolation": options={"resistanceScale":10}
    status,reason,x=domain_status(edited,options,network)
    assert status=="out-of-domain" and reason and x is None


def test_area_and_target_do_not_enter_hydraulic_feature_path(prepared):
    network,_,_=prepared
    a=domain_status(network,{},network)[2]
    options={"overrides":{network["edges"][1]["id"]:{"area":12,"target":20}}}
    b=domain_status(network,options,network)[2]
    assert np.array_equal(a,b)
    c=domain_status(network,{"resistanceScale":1.4},network)[2]
    assert not np.array_equal(a,c)


def test_all_six_regimes_have_actual_solutions_and_exact_speed_scaling(prepared):
    network,_,_=prepared
    results={r["id"]:solve(network,regime_options(network,r["id"])) for r in REGIMES}
    assert all(r["converged"] for r in results.values())
    base=np.asarray(results["nominal"]["flows"])
    assert np.allclose(results["turndown"]["flows"],base*.65,atol=1e-8)
    assert np.allclose(results["boost"]["flows"],base*1.25,atol=1e-8)
    assert not np.allclose(results["working-restriction"]["flows"],base)
    assert not np.allclose(results["return-restriction"]["flows"],base)


def test_recall_counts_are_derived_and_empty_classes_are_null():
    actual=np.array([[5.,15.,0.],[12.,8.,0.]])
    predicted=np.array([[11.,15.,0.],[8.,8.,0.]])
    metrics=confusion_metrics(predicted,actual,np.array([10.,10.,0.]))
    assert metrics["shortfallTruePositive"]==1
    assert metrics["shortfallFalseNegative"]==1
    assert metrics["adequateTrueNegative"]==1
    assert metrics["adequateFalsePositive"]==1
    assert metrics["shortfallRecall"]==.5 and metrics["adequateRecall"]==.5
    assert confusion_metrics(actual,actual,np.zeros(3))["shortfallRecall"] is None


def test_gnn_is_equivariant_to_node_and_edge_permutation(prepared):
    torch=pytest.importorskip("torch")
    from aerovia_pipeline.surrogate_models import GraphSurrogate,tensor_graph
    _,g,_=prepared
    torch.manual_seed(12)
    model=GraphSurrogate().eval()
    rng=np.random.default_rng(21)
    ep=rng.permutation(len(g["q_base"]))
    np_=rng.permutation(len(g["p_base"]))
    swapped=dict(g)
    swapped["edge_static"]=g["edge_static"][ep]
    swapped["node_static"]=g["node_static"][np_]
    for key in ("source_select","target_select"):
        swapped[key]=g[key][ep][:,np_]
    for key in ("incoming","outgoing"):
        swapped[key]=g[key][np_][:,ep]
    x=torch.as_tensor(rng.normal(size=(3,len(ep))).astype(np.float32))
    with torch.inference_mode():
        first=model(x,tensor_graph(g)).numpy()
        second=model(x[:,ep],tensor_graph(swapped)).numpy()
    assert np.max(np.abs(first[:,ep]-second))<2e-7


def test_neural_prediction_changes_with_resistance_without_solver(prepared,monkeypatch):
    torch=pytest.importorskip("torch")
    from aerovia_pipeline.surrogate_models import TopologyMLP,ExportedSurrogate,numpy_postprocess
    _,g,_=prepared
    torch.manual_seed(9)
    model=TopologyMLP(len(g["q_base"])).eval()
    wrapper=ExportedSurrogate(model,g)
    def forbidden(*args,**kwargs): raise AssertionError("Inference must not call the nonlinear solver")
    monkeypatch.setattr("aerovia_pipeline.model.solve",forbidden)
    x=torch.zeros((2,len(g["q_base"])))
    x[1,2]=.4
    with torch.inference_mode():
        actual=[v.numpy() for v in wrapper(x)]
        expected=numpy_postprocess(model(x).numpy(),x.numpy(),g)
    assert not np.allclose(actual[1][0],actual[1][1])
    assert np.max(np.abs(actual[1]-expected[1]))<1e-4
    assert np.max(np.abs(actual[2]-expected[2]))<.005


def test_resume_preserves_training_state_exactly(prepared,tmp_path):
    torch=pytest.importorskip("torch")
    from aerovia_pipeline.surrogate_train import train_one,load_model
    network,g,work=prepared
    rng=np.random.default_rng(2)
    folder=work/"features"
    folder.mkdir()
    for split in ("train","validation"):
        np.savez_compressed(folder/f"{network['id']}.{split}.npz",x=rng.normal(0,.1,(16,len(g["q_base"]))).astype(np.float32),y=rng.normal(0,.01,(16,len(g["q_base"]))).astype(np.float32))
    full=train_one(work,"topology-mlp",[network["id"]],"cpu",2,8,17,hidden=16)
    a,_=load_model(work/full["checkpoint"])
    expected={k:v.clone() for k,v in a.state_dict().items()}
    train_one(work,"topology-mlp",[network["id"]],"cpu",1,8,17,hidden=16)
    resumed=train_one(work,"topology-mlp",[network["id"]],"cpu",2,8,17,resume=True,hidden=16)
    b,_=load_model(work/resumed["checkpoint"])
    assert all(torch.equal(expected[k],v) for k,v in b.state_dict().items())
