from copy import deepcopy
import math
import numpy as np
import pytest

from aerovia_pipeline.cases import create_cases, network, node, edge
from aerovia_pipeline.model import solve, validate_network, NetworkError
from aerovia_pipeline.ensemble import resistance_draws, run_ensemble


def analytic(parallel=False):
    n=network("analytic","Analytic fixture","Caso analítico","Exact mathematical fixture","Caso matemático exacto")
    node(n,"a",0,0,0,0)
    node(n,"j",1,0,-1)
    node(n,"b",2,0,0,0)
    edge(n,"fan","a","j","fan",.1,20,fan={"pressure":1600,"coefficient":.1,"efficiency":.8})
    edge(n,"work","j","b","working",.8,10,20)
    if parallel:
        edge(n,"parallel","j","b","working",3.2,8,10)
    return n


def test_analytic_series_flow_pressure_and_electric_power():
    result=solve(analytic())
    assert result["converged"]
    assert result["flows"]==pytest.approx([40,40],abs=1e-8)
    assert result["pressures"]==pytest.approx([0,1280,0],abs=1e-7)
    assert result["fanPowerKW"]==pytest.approx((1600-.1*40**2)*40/.8/1000,rel=1e-9)
    assert result["totalIntake"]==pytest.approx(40,abs=1e-8)
    assert result["targetRatio"]==pytest.approx(2,abs=1e-8)


def test_analytic_parallel_split_and_equivalent_resistance():
    result=solve(analytic(True))
    equivalent=1/(1/math.sqrt(.8)+1/math.sqrt(3.2))**2
    total=math.sqrt(1600/(.2+equivalent))
    assert result["converged"]
    assert result["flows"]==pytest.approx([total,total*2/3,total/3],rel=1e-9)


def test_passive_orientation_preserves_pressure_and_reverses_flow():
    n=analytic()
    original=solve(n)
    n["edges"][1]["from"],n["edges"][1]["to"]="b","j"
    result=solve(n)
    assert result["converged"]
    assert result["pressures"]==pytest.approx(original["pressures"],abs=1e-8)
    assert result["flows"][1]==pytest.approx(-original["flows"][1],abs=1e-8)
    assert result["shortfalls"][1]==pytest.approx(60,abs=1e-8)


def test_zero_speed_and_homogeneous_speed_scaling():
    n=analytic(True)
    original=solve(n)
    zero=solve(n,{"speed":0})
    assert zero["converged"]
    assert zero["flows"]==pytest.approx([0,0,0],abs=1e-8)
    assert zero["fanPowerKW"]==pytest.approx(0)
    scaled=solve(n,{"speed":.6})
    assert scaled["converged"]
    assert scaled["flows"]==pytest.approx(np.array(original["flows"])*.6,rel=1e-8)
    assert scaled["pressures"]==pytest.approx(np.array(original["pressures"])*.6**2,abs=1e-7)
    assert scaled["fanPowerKW"]==pytest.approx(original["fanPowerKW"]*.6**3,rel=1e-8)


def test_closed_parallel_branch_is_zero_and_retains_target_deficit():
    result=solve(analytic(True),{"overrides":{"parallel":{"closed":True}}})
    assert result["converged"]
    assert result["flows"]==pytest.approx([40,40,0],abs=1e-8)
    assert result["shortfalls"][2]==10
    assert result["targetRatio"]==0


def test_closure_isolation_rejected_without_arbitrary_pressure_anchor():
    with pytest.raises(NetworkError,match="open path"):
        solve(analytic(),{"overrides":{"fan":{"closed":True},"work":{"closed":True}}})


def test_fixed_nonzero_boundary_pressure_is_conserved():
    n=analytic()
    n["nodes"][0]["boundary"]=100
    n["nodes"][2]["boundary"]=100
    result=solve(n)
    assert result["converged"]
    assert result["flows"]==pytest.approx([40,40],abs=1e-8)
    assert result["pressures"]==pytest.approx([100,1380,100],abs=1e-7)


def test_reverse_fan_is_explicit_unsupported_state():
    n=analytic()
    n["nodes"][2]["boundary"]=5000
    result=solve(n)
    assert not result["converged"]
    assert "Unsupported fan" in result["message"]


@pytest.mark.parametrize("mutation",[
    lambda n:n["nodes"].append(deepcopy(n["nodes"][0])),
    lambda n:n["edges"][0].update(resistance=0),
    lambda n:n["edges"][0].update(area=float("nan")),
    lambda n:n["edges"][0]["fan"].update(efficiency=0),
    lambda n:n["edges"][0].update(to="missing"),
    lambda n:n["nodes"][0].update(x=True),
    lambda n:n["edges"][0].update(to=[]),
    lambda n:n.update(schema="unversioned"),
])
def test_invalid_networks_rejected(mutation):
    n=analytic()
    mutation(n)
    with pytest.raises(NetworkError):
        validate_network(n)


@pytest.mark.parametrize("options",[{"speed":2},{"speed":float("nan")},{"resistanceScale":0},{"overrides":{"nope":{}}},{"overrides":{"fan":{"closed":"yes"}}}])
def test_invalid_options_rejected(options):
    with pytest.raises(NetworkError):
        solve(analytic(),options)


@pytest.mark.parametrize("case",create_cases(),ids=lambda n:n["id"])
def test_all_authored_cases_conserve_mass_and_pressure(case):
    for speed in (0,.35,1,1.5):
        result=solve(case,{"speed":speed})
        assert result["converged"],result
        assert result["massResidual"]<=1e-6
        assert result["pressureResidual"]<=1e-5


def test_leakage_sealing_improves_every_working_target_ratio():
    cases={case["id"]:case for case in create_cases()}
    opened,sealed=solve(cases["leakage-open"]),solve(cases["leakage-sealed"])
    for i,e in enumerate(cases["leakage-open"]["edges"]):
        if e["kind"]=="working":
            assert sealed["flows"][i]>opened["flows"][i]


def test_identical_seed_produces_identical_mean_one_resistance_draws():
    r=np.array([.1,1,10])
    a=resistance_draws(r,8192,123,.2)
    b=resistance_draws(r,8192,123,.2)
    assert np.array_equal(a,b)
    assert np.mean(a,axis=0)==pytest.approx(r,rel=.01)
    assert np.std(a,axis=0)/np.mean(a,axis=0)==pytest.approx([.2]*3,abs=.008)
    assert np.all(a>0)


def test_cpu_batch_agrees_with_independent_scipy_reference():
    n=analytic(True)
    ensemble,fixtures=run_ensemble(n,solve(n),samples=32,seed=42,cv=.2)
    assert ensemble["failures"]==0
    assert ensemble["parityMaxAbsFlow"]<1e-4
    assert ensemble["maxMassResidual"]<=1e-6
    assert ensemble["maxPressureResidual"]<=1e-5
    assert len(fixtures)==8
    assert np.all(np.array(ensemble["flowP05"])<=ensemble["flowP50"])
    assert np.all(np.array(ensemble["flowP50"])<=ensemble["flowP95"])


def test_zero_cv_ensemble_collapses_to_deterministic_solution():
    n=analytic(True)
    result=solve(n)
    ensemble,_=run_ensemble(n,result,samples=8,seed=10,cv=0)
    for field in ("flowP05","flowP50","flowP95"):
        assert ensemble[field]==pytest.approx(result["flows"],abs=1e-8)


def test_all_closed_boundary_only_graph_is_a_valid_zero_flow_state():
    n=network("closed","Closed boundary link","Enlace cerrado","Both nodes are pressure boundaries","Ambos nodos son límites de presión")
    node(n,"a",0,0,0,0)
    node(n,"b",1,0,0,0)
    edge(n,"passive","a","b","working",1,10,5)
    result=solve(n,{"overrides":{"passive":{"closed":True}}})
    assert result["converged"]
    assert result["flows"]==[0]
    assert result["shortfalls"]==[5]


def test_ensemble_batches_bound_memory_and_preserve_seeded_order():
    n=analytic(True)
    result=solve(n)
    ensemble,_=run_ensemble(n,result,samples=264,seed=123,cv=.15)
    assert ensemble["failures"]==0
    assert ensemble["acceptedSamples"]==264
    assert ensemble["batchSize"]==256
    assert ensemble["parityMaxAbsFlow"]<1e-4
