from __future__ import annotations
import sqlite3
from pathlib import Path
import pandas as pd
from .base import strip_schema

class SQLiteDB:
    def __init__(self, path: Path, readonly: bool = True):
        uri = f"file:{path}?mode={'ro' if readonly else 'rw'}"
        self.conn = sqlite3.connect(uri, uri=True)

    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame:
        return pd.read_sql_query(strip_schema(sql), self.conn, params=params)

    def execute(self, sql: str, params: tuple = ()) -> None:
        self.conn.execute(strip_schema(sql), params)
        self.conn.commit()

    def table_count(self, table: str) -> int:
        t = table.split(".")[-1]
        return self.conn.execute(f'select count(*) from "{t}"').fetchone()[0]
