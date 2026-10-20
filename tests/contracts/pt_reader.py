"""Read a torch checkpoint (``torch.save``, zip format) without torch (catalog row checkpoint).

The file is a zip whose ``data.pkl`` is a pickle; the weights are separate records. This reader runs that pickle with a
restricted unpickler that knows only what a checkpoint of this product holds (plain dicts and lists, ``OrderedDict``,
tensor rebuilds, storage types, ``TorchVersion``) and refuses any other global, so a hostile file cannot run code. A tensor
comes back as its shape and element type (``{"shape": [..], "dtype": "float32"}``), never its values: the contract is the
structure, and the values are the weights the ONNX files already carry.
"""
from __future__ import annotations

import pickle
import zipfile
from collections import OrderedDict
from pathlib import Path
from typing import Any

DTYPES = {"FloatStorage": "float32", "DoubleStorage": "float64", "HalfStorage": "float16", "BFloat16Storage": "bfloat16",
          "LongStorage": "int64", "IntStorage": "int32", "ShortStorage": "int16", "CharStorage": "int8", "ByteStorage": "uint8",
          "BoolStorage": "bool"}


class _Storage:
    def __init__(self, name: str) -> None:
        self.dtype = DTYPES.get(name, name)


def _rebuild_tensor(storage: _Storage, offset: int, size: tuple, stride: tuple, *rest: Any) -> dict:
    return {"shape": [int(n) for n in size], "dtype": storage.dtype}


class _Unpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module == "collections" and name == "OrderedDict":
            return OrderedDict
        if module == "torch._utils" and name == "_rebuild_tensor_v2":
            return _rebuild_tensor
        if module == "torch" and name.endswith("Storage"):
            return name
        if module == "torch.torch_version" and name == "TorchVersion":
            return str
        raise pickle.UnpicklingError(f"global {module}.{name} is not allowed in a checkpoint")

    def persistent_load(self, pid: Any) -> Any:
        kind, storage_type, *_ = pid
        if kind != "storage":
            raise pickle.UnpicklingError(f"persistent id {kind!r} is not allowed in a checkpoint")
        return _Storage(storage_type if isinstance(storage_type, str) else getattr(storage_type, "__name__", str(storage_type)))


def read_checkpoint(path: str | Path) -> dict[str, Any]:
    """The checkpoint dict at ``path`` with every tensor replaced by its shape and dtype."""
    with zipfile.ZipFile(path) as archive:
        names = [n for n in archive.namelist() if n.endswith("/data.pkl")]
        if len(names) != 1:
            raise ValueError(f"{path}: expected one data.pkl in the archive, found {len(names)}")
        with archive.open(names[0]) as handle:
            value = _Unpickler(handle).load()
    if not isinstance(value, dict):
        raise ValueError(f"{path}: the checkpoint is a {type(value).__name__}, not a dict")
    return _plain(value)


def _plain(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value
