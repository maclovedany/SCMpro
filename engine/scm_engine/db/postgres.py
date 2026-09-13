from __future__ import annotations
import psycopg
import pandas as pd

class PostgresDB:
    def __init__(self, dsn: str):
        self.conn = psycopg.connect(dsn, autocommit=True)

    def read_df(self, sql: str, params: tuple = ()) -> pd.DataFrame:
        with self.conn.cursor() as cur:
            cur.execute(sql, params or None)   # params 없으면 % 를 플레이스홀더로 해석하지 않음
            cols = [d.name for d in cur.description]
            return pd.DataFrame(cur.fetchall(), columns=cols)

    def execute(self, sql: str, params: tuple = ()) -> None:
        with self.conn.cursor() as cur:
            cur.execute(sql, params or None)

    def table_count(self, table: str) -> int:
        return int(self.read_df(f"select count(*) as n from {table}").iloc[0, 0])
