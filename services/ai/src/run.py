"""Counsel AI Service runner — standalone entry point for uvicorn."""
import sys, os

_src = os.path.dirname(os.path.abspath(__file__))
if _src not in sys.path:
    sys.path.insert(0, _src)

# Force main.py to run as __main__ so relative imports work
import importlib.util
spec = importlib.util.spec_from_file_location("main", os.path.join(_src, "main.py"))
main_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main_mod)
app = main_mod.app
