# Measured resources of Aerovia

The evidence behind the numbers that [`SDD.md`](SDD.md) states in its Resources section. Measured on 2026-10-20 on the development
workstation (Windows 11 10.0.26300, Python 3.13.14 in the base venv with numpy 2.5.3 and scipy 1.18.1, Node v24.14.1, npm 11.11.0),
in the worktree of the branch `task/base-0-08-sdd` (a checkout of the base branch at commit 824c0be plus the design area), after
`npm ci`. Nothing the measurement wrote was kept: the bake wrote into a throwaway folder in the device's temp root, deleted
afterwards, and `git status` shows no changed tracked file. Sizes are bytes of file content unless a line says otherwise. The
CUDA bake and the model training are not re-run here (the base venv has no torch); their rows in the SDD are the committed receipts
of 2026-09-10, quoted below with the file they are read from.

The wrapper `measure.py` runs a command as a child and prints its wall time, the peak working set of the largest single process
and the largest sum of working sets over the whole process tree, polled every 50 ms from the parent (the Windows venv launcher is
a parent process of the real interpreter, so the whole tree is read).

```python
"""Run a command, print its wall time, the peak working set of its main process (polled every 50 ms from the parent
through GetProcessMemoryInfo, a peak counter, so the last read is the peak) and the peak committed memory of the whole
process tree (a Windows job object: PeakJobMemoryUsed), and its exit code.  usage: measure.py <cwd> -- <command...>"""
import ctypes
import ctypes.wintypes as wt
import subprocess
import sys
import time

k32 = ctypes.WinDLL("kernel32", use_last_error=True)
psapi = ctypes.WinDLL("psapi", use_last_error=True)
k32.OpenProcess.restype = wt.HANDLE
k32.CreateJobObjectW.restype = wt.HANDLE
k32.AssignProcessToJobObject.argtypes = [wt.HANDLE, wt.HANDLE]
psapi.GetProcessMemoryInfo.argtypes = [wt.HANDLE, ctypes.c_void_p, wt.DWORD]


class PMC(ctypes.Structure):
    _fields_ = [("cb", wt.DWORD), ("PageFaultCount", wt.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t)]


class BASIC(ctypes.Structure):
    _fields_ = [("PerProcessUserTimeLimit", ctypes.c_int64), ("PerJobUserTimeLimit", ctypes.c_int64), ("LimitFlags", wt.DWORD),
                ("MinimumWorkingSetSize", ctypes.c_size_t), ("MaximumWorkingSetSize", ctypes.c_size_t),
                ("ActiveProcessLimit", wt.DWORD), ("Affinity", ctypes.c_size_t), ("PriorityClass", wt.DWORD),
                ("SchedulingClass", wt.DWORD)]


class IO(ctypes.Structure):
    _fields_ = [(n, ctypes.c_uint64) for n in ("ReadOps", "WriteOps", "OtherOps", "ReadBytes", "WriteBytes", "OtherBytes")]


class EXT(ctypes.Structure):
    _fields_ = [("Basic", BASIC), ("Io", IO), ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]


class PE32(ctypes.Structure):
    _fields_ = [("dwSize", wt.DWORD), ("cntUsage", wt.DWORD), ("th32ProcessID", wt.DWORD), ("th32DefaultHeapID", ctypes.c_size_t),
                ("th32ModuleID", wt.DWORD), ("cntThreads", wt.DWORD), ("th32ParentProcessID", wt.DWORD),
                ("pcPriClassBase", ctypes.c_long), ("dwFlags", wt.DWORD), ("szExeFile", ctypes.c_wchar * 260)]


k32.CreateToolhelp32Snapshot.restype = wt.HANDLE


def descendants(root: int) -> set[int]:
    snap = k32.CreateToolhelp32Snapshot(2, 0)
    pe = PE32()
    pe.dwSize = ctypes.sizeof(pe)
    parent_of = {}
    ok = k32.Process32FirstW(snap, ctypes.byref(pe))
    while ok:
        parent_of[pe.th32ProcessID] = pe.th32ParentProcessID
        ok = k32.Process32NextW(snap, ctypes.byref(pe))
    k32.CloseHandle(snap)
    found = {root}
    grew = True
    while grew:
        grew = False
        for pid, parent in parent_of.items():
            if parent in found and pid not in found:
                found.add(pid)
                grew = True
    return found


def main() -> int:
    cwd = sys.argv[1]
    cmd = sys.argv[sys.argv.index("--") + 1:]
    start = time.perf_counter()
    p = subprocess.Popen(cmd, cwd=cwd)
    peak_one = 0
    peak_sum = 0
    seen: set[int] = set()
    handles: dict[int, int] = {}
    c = PMC()
    c.cb = ctypes.sizeof(c)
    while p.poll() is None:
        total = 0
        for pid in descendants(p.pid):
            seen.add(pid)
            if pid not in handles:
                handles[pid] = k32.OpenProcess(0x1F0FFF, False, pid)
            if handles[pid] and psapi.GetProcessMemoryInfo(handles[pid], ctypes.byref(c), c.cb):
                peak_one = max(peak_one, c.PeakWorkingSetSize)
                total += c.WorkingSetSize
        peak_sum = max(peak_sum, total)
        time.sleep(0.05)
    elapsed = time.perf_counter() - start
    print(f"MEASURE exit={p.returncode} wall_s={elapsed:.1f} peak_working_set_one_process_mb={peak_one / 1048576:.0f} "
          f"peak_working_set_sum_of_tree_mb={peak_sum / 1048576:.0f} processes_seen={len(seen)}")
    return p.returncode


sys.exit(main())
```

## The install

```
$ python measure.py frontend -- npm.cmd ci --cache <temp root>/npm-cache
MEASURE exit=0 wall_s=59.3 peak_working_set_one_process_mb=551 peak_working_set_sum_of_tree_mb=557 processes_seen=10
$ du -sk frontend/node_modules | cut -f1
354950
```

`npm ci` takes 59.3 s and peaks at 557 MB summed over 10 processes. The npm cache is shared with other sessions, so whether it was
warm for this run is not controlled; the time is a single run.

## The CPU bake: time, memory and size

```
$ python measure.py . -- python scripts/pipeline.py bake --device cpu --samples 256 --seed 20260909 --cv 0.15 --output <temp root>/bake
{"verifiedFiles": 14, "verifiedCases": 12, "schema": "aerovia.catalog/v1"}
MEASURE exit=0 wall_s=389.3 peak_working_set_one_process_mb=118 peak_working_set_sum_of_tree_mb=122 processes_seen=2
$ find <temp root>/bake -type f | wc -l
15
$ find <temp root>/bake -type f | xargs du -cb | tail -1
1646976	total
```

The same arguments as the committed receipt (`docs/methods/execution-evidence.md`) with the device on `cpu`: 12 cases, 256 draws per
case, seed 20260909, coefficient of variation 0.15. The bake takes 389.3 s and peaks at 122 MB summed (118 MB in the Python
process); it wrote 1,646,976 bytes in 15 files. The committed CUDA bake wrote 1,647,711 bytes (the receipt) and records, in
`data/artifacts/catalog.json` `benchmark`, a pipeline timer of 4033.71 ms (`totalElapsedMs`), 270.64 ms of SciPy reference solves
(`referenceElapsedMs`) and 1561.81 ms of CUDA batch solves (`ensembleElapsedMs`) on an NVIDIA GeForce RTX 4070 Laptop GPU with
PyTorch 2.13.0+cu126 and CUDA 12.6. The CPU figure is a measurement of the CPU lane; the CUDA figures are the receipt's, and the
timer of the receipt starts after the module imports.

## The training receipt

Read from `data/artifacts/science.json` `training.models` (13 entries: 12 `topology-mlp`, one `graph-surrogate`): the sum of
`elapsedSeconds` is 1268.4 s, from 17.4 s to 1045.4 s per model, on the RTX 4070 Laptop GPU (torch 2.13.0+cu126, CUDA 12.6, float32);
the sum of the best checkpoints' `bytes` is 1,583,701. The dataset generation took 58.3 s (`training.datasetSeconds`) for 33,792
states. The receipt records no memory figure.

```
$ git ls-files data/models | wc -l
42
$ git ls-files data/models | xargs du -cb | tail -1
6615401	total
$ git ls-files data | wc -l
61
$ git ls-files data | xargs du -cb | tail -1
11586914	total
```

## The tests

```
$ python measure.py . -- python -m pytest -p no:cacheprovider -q            (tests/contracts and tests/python)
199 passed, 4 skipped in 55.75s
MEASURE exit=0 wall_s=57.6 peak_working_set_one_process_mb=118 peak_working_set_sum_of_tree_mb=149 processes_seen=46
$ python measure.py frontend -- npm.cmd test                                  (vitest run)
 Test Files  20 passed (20)
      Tests  455 passed (455)
MEASURE exit=0 wall_s=2.4 peak_working_set_one_process_mb=216 peak_working_set_sum_of_tree_mb=1743 processes_seen=29
```

The Python suite takes 57.6 s and peaks at 149 MB summed; the four skips are tests that import torch, which the base venv does not install
(`tests/contracts/test_fixtures.py` and three in `tests/python/test_surrogates.py`). The web unit tests take 2.4 s and peak at 1743 MB summed over 29 processes, the vitest workers. The browser journeys
(`npm run test:e2e`, 73 passed in 2.8 min) are the workbench unit's figure, from its report; their memory was not measured here.

## The build and the deploy payload

```
$ python measure.py frontend -- npm.cmd run build
Static manifest: 124 files, 25970922 bytes.
MEASURE exit=0 wall_s=5.3 peak_working_set_one_process_mb=373 peak_working_set_sum_of_tree_mb=534 processes_seen=17
```

`npm run build` (typecheck, data preparation, vite, static manifest) takes 5.3 s and peaks at 534 MB summed. Its static manifest
lists 124 files and 25,970,922 bytes, the payload of the Pages deploy, against the 32 MB total and 25 MB per-file budget stated in
`deploy/README.md`. The duration of the Pages workflow itself is not measured in this release.
