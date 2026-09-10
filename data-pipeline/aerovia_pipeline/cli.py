"""Run with python scripts/pipeline.py --help from any working directory."""
import argparse
import json
import platform
from pathlib import Path
import sys
from time import perf_counter

import numpy as np
import scipy

from . import __version__
from .cases import create_cases
from .ensemble import run_ensemble
from .io import digest, export_csv, fetch_network, load_networks, project_options, utc_now, verify_artifacts, write_json, write_manifest
from .model import NetworkError, solve, validate_network

ROOT = Path(__file__).resolve().parents[2]


def parser():
    p=argparse.ArgumentParser(description="Aerovia offline network creation, acquisition, reference solution and CUDA uncertainty baking")
    sub=p.add_subparsers(dest="command",required=True)
    create=sub.add_parser("create",help="Recreate the 12 authored Apache-2.0 engineering cases")
    create.add_argument("--output",type=Path,default=ROOT/"data/cases.json")
    validate=sub.add_parser("validate",help="Strictly validate public network JSON")
    validate.add_argument("--input",type=Path,default=ROOT/"data/cases.json")
    fetch=sub.add_parser("fetch",help="Acquire and validate checksum-pinned public HTTPS network JSON")
    fetch.add_argument("--url",required=True)
    fetch.add_argument("--sha256",required=True)
    fetch.add_argument("--output",type=Path,required=True)
    for name in ("solve","bake"):
        command=sub.add_parser(name,help="Solve imported networks" if name=="solve" else "Bake reference solutions and CPU/CUDA uncertainty artifacts")
        command.add_argument("--input",type=Path,default=ROOT/"data/cases.json")
        command.add_argument("--output",type=Path,default=ROOT/("build/local/solution" if name=="solve" else "build/local/artifacts"))
        command.add_argument("--speed",type=float,help="Override common fan speed; otherwise retain imported project speed or default 1")
        command.add_argument("--resistance-scale",type=float,help="Override global resistance scale; otherwise retain imported project scale or default 1")
        command.add_argument("--options",type=Path,help="Optional options JSON; values override the speed/scale flags")
        if name=="bake":
            command.add_argument("--device",choices=("cpu","cuda"),default="cpu")
            command.add_argument("--samples",type=int,default=256)
            command.add_argument("--seed",type=int,default=20260909)
            command.add_argument("--cv",type=float,default=.15)
    verify=sub.add_parser("verify",help="Verify checksums, contracts, conservation and parity acceptance")
    verify.add_argument("--artifacts",type=Path,default=ROOT/"data/artifacts")
    return p


def main(argv=None):
    args=parser().parse_args(argv)
    try:
        if args.command=="create":
            cases=create_cases()
            for case in cases:
                validate_network(case)
            write_json(args.output,cases)
            print(json.dumps({"cases":len(cases),"sourceSha256":digest(cases),"license":"Apache-2.0"}))
            return 0
        if args.command=="validate":
            cases=load_networks(args.input)
            print(json.dumps({"valid":True,"cases":len(cases),"nodes":sum(len(c["nodes"]) for c in cases),"edges":sum(len(c["edges"]) for c in cases)}))
            return 0
        if args.command=="fetch":
            print(json.dumps(fetch_network(args.url,args.sha256,args.output)))
            return 0
        if args.command=="verify":
            print(json.dumps(verify_artifacts(args.artifacts)))
            return 0
        started=perf_counter()
        cases=load_networks(args.input)
        options={"speed":1,"resistanceScale":1,"overrides":{},**project_options(args.input)}
        if args.speed is not None:
            options["speed"]=args.speed
        if args.resistance_scale is not None:
            options["resistanceScale"]=args.resistance_scale
        if args.options:
            if args.options.stat().st_size>1024*1024:
                raise NetworkError("Options exceed 1 MiB")
            supplied=json.loads(args.options.read_text(encoding="utf-8-sig"))
            if not isinstance(supplied,dict):
                raise NetworkError("Options must be a JSON object")
            options.update(supplied)
        artifacts,parity=[],[]
        for i,network in enumerate(cases):
            result=solve(network,options)
            if not result["converged"]:
                write_json(args.output/(network["id"]+"-failure.json"),{"network":network,"options":options,"result":result})
                raise NetworkError(f"{network['id']}: {result.get('message','reference solve failed')}")
            entry={"network":network,"options":options,"sourceSha256":digest(network),"optionsSha256":digest(options),"result":result}
            if args.command=="bake":
                summary,fixtures=run_ensemble(network,result,samples=args.samples,seed=(args.seed+i)%2**32,cv=args.cv,device=args.device,options=options)
                entry["ensemble"]=summary
                parity.extend(fixtures)
            artifacts.append(entry)
            export_csv(args.output/"csv"/(network["id"]+".csv"),network,result,entry.get("ensemble"),options)
            print(json.dumps({"case":network["id"],"converged":result["converged"],"massResidual":result["massResidual"],"pressureResidual":result["pressureResidual"],"ensembleFailures":entry.get("ensemble",{}).get("failures"),"device":entry.get("ensemble",{}).get("device")}),flush=True)
        benchmark={"python":platform.python_version(),"numpy":np.__version__,"scipy":scipy.__version__,"engineVersion":__version__,
                   "referenceMethod":"SciPy least_squares trust-region reflective, analytical mixed flow/pressure Jacobian, float64",
                   "referenceElapsedMs":sum(x["result"]["elapsedMs"] for x in artifacts),"totalElapsedMs":(perf_counter()-started)*1000,
                   "caseCount":len(cases),"nodeCount":sum(len(c["nodes"]) for c in cases),"edgeCount":sum(len(c["edges"]) for c in cases),
                   "maxMassResidual":max(x["result"]["massResidual"] for x in artifacts),"maxPressureResidual":max(x["result"]["pressureResidual"] for x in artifacts)}
        if args.command=="bake":
            benchmark.update({"device":args.device,"hardware":artifacts[0]["ensemble"]["hardware"],"backend":artifacts[0]["ensemble"]["backend"],
                              "samplesPerCase":args.samples,"ensembleSamples":sum(x["ensemble"]["samples"] for x in artifacts),
                              "ensembleElapsedMs":sum(x["ensemble"]["elapsedMs"] for x in artifacts),"ensembleFailures":sum(x["ensemble"]["failures"] for x in artifacts),
                              "parityMaxAbsFlow":max(x["ensemble"]["parityMaxAbsFlow"] for x in artifacts),"paritySamples":len(parity)})
        catalog={"schema":"aerovia.catalog/v1","createdAt":utc_now(),"sourceSha256":digest(cases),"cases":artifacts,"benchmark":benchmark}
        write_json(args.output/"catalog.json",catalog)
        if parity:
            write_json(args.output/"reference-checks.json",{"schema":"aerovia.reference-checks/v1","fixtures":parity})
        write_manifest(args.output,{"engineVersion":__version__,"sourceSha256":digest(cases),"device":getattr(args,"device","cpu-reference"),"caseCount":len(cases)})
        print(json.dumps(verify_artifacts(args.output)))
        return 0
    except (NetworkError,OSError,ValueError,KeyError,ImportError) as exc:
        print(f"Aerovia pipeline: {exc}",file=sys.stderr)
        return 2
