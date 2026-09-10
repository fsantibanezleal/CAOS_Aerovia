#!/usr/bin/env python3
"""Complete offline learned-model workflow. Public release export is explicit."""
from pathlib import Path
import argparse
import json
import os
import sys
from importlib import import_module

os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data-pipeline"))
from aerovia_pipeline.model import NetworkError


def main(argv=None):
    parser = argparse.ArgumentParser(description="Aerovia reproducible learned airflow methods")
    parser.add_argument("stage", choices=("ingest", "preprocess", "dataset", "features", "train", "infer", "evaluate", "diagnostics", "export", "validate", "bake"))
    parser.add_argument("--input", default="data/cases.json", help="validated network array")
    parser.add_argument("--work", default="build/surrogates", help="local staged inputs, datasets and resumable checkpoints")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cuda")
    parser.add_argument("--inference-device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--train-samples", type=int, default=2048)
    parser.add_argument("--validation-samples", type=int, default=256)
    parser.add_argument("--calibration-samples", type=int, default=256)
    parser.add_argument("--test-samples", type=int, default=256)
    parser.add_argument("--scipy-checks", type=int, default=8)
    parser.add_argument("--seed", type=int, default=20260910)
    parser.add_argument("--mlp-epochs", type=int, default=350)
    parser.add_argument("--graph-epochs", type=int, default=400)
    parser.add_argument("--family-epochs", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--method", choices=("all", "topology-mlp", "graph-surrogate"), default="all")
    parser.add_argument("--models-output", default="build/surrogates/release/models")
    parser.add_argument("--science-output", default="build/surrogates/release/science.json")
    args = parser.parse_args(argv)
    try:
        from aerovia_pipeline.surrogate_data import ingest, preprocess, dataset, features, METHODS
        from aerovia_pipeline.surrogate_evaluate import evaluate
        from aerovia_pipeline.surrogate_validate import validate_release
        def call(module, function, *parameters):
            return getattr(import_module(f"aerovia_pipeline.{module}"),function)(*parameters)
        stages = {
            "ingest": lambda: ingest(args.input, args.work),
            "preprocess": lambda: preprocess(args.work),
            "dataset": lambda: dataset(args.work, args.device, args.seed, args.train_samples, args.validation_samples, args.calibration_samples, args.test_samples, args.scipy_checks),
            "features": lambda: features(args.work),
            "train": lambda: call("surrogate_train","train",args.work, args.device, args.mlp_epochs, args.graph_epochs, args.batch_size, args.seed, args.resume, METHODS if args.method == "all" else (args.method,)),
            "infer": lambda: call("surrogate_train","infer",args.work, args.inference_device),
            "evaluate": lambda: evaluate(args.work),
            "diagnostics": lambda: call("surrogate_diagnostics","diagnostics",args.work,args.device,args.family_epochs,args.seed,args.resume),
            "export": lambda: call("surrogate_export","export",args.work, args.models_output, args.science_output),
            "validate": lambda: validate_release(args.models_output, args.science_output,args.input),
        }
        selected = tuple(stages) if args.stage == "bake" else (args.stage,)
        for stage in selected:
            print(f"stage {stage}", flush=True)
            result = stages[stage]()
            print(json.dumps({"stage": stage, "complete": True, "schema": result.get("schema"),
                              "result": result if stage == "validate" else None}, allow_nan=False), flush=True)
        return 0
    except (NetworkError, ValueError, OSError, ImportError) as exc:
        print(f"Aerovia surrogate stage failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
