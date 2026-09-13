from __future__ import annotations
import re
from typing import Protocol
import pandas as pd

SCHEMA_RE = re.compile(r"\b(raw|core|analytics|app)\.")

def strip_schema(sql: str) -> str:
    return SCHEMA_RE.sub("", sql)

class DB(Protocol):
    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame: ...
    def execute(self, sql: str, params: tuple = ()) -> None: ...
    def table_count(self, table: str) -> int: ...
