"""Supabase Database 타입(TS) 생성 — supabase CLI 는 Docker 가 필요해 information_schema 로 직접 생성."""
from __future__ import annotations
from .db.postgres import PostgresDB

PG_TS = {"text": "string", "character varying": "string", "character": "string", "uuid": "string", "date": "string",
         "timestamp with time zone": "string", "timestamp without time zone": "string", "jsonb": "Json", "json": "Json",
         "boolean": "boolean", "integer": "number", "bigint": "number", "smallint": "number", "numeric": "number",
         "double precision": "number", "real": "number", "ARRAY": "string[]", "USER-DEFINED": None}

def _ts(col) -> str:
    t = PG_TS.get(col["data_type"], "unknown")
    if t is None:  # enum
        t = f'Database["{col["udt_schema"]}"]["Enums"]["{col["udt_name"]}"]' if col["udt_schema"] in ("app",) else "string"
    return t

def generate(db: PostgresDB, schemas: tuple[str, ...] = ("app", "analytics", "core")) -> str:
    out = ['export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]', "", "export type Database = {"]
    for sc in schemas:
        rels = db.read_df("""
          select c.relname as name, c.relkind as kind from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = %s and c.relkind in ('r','v','m') order by 1""", (sc,))
        cols = db.read_df("""
          select c.relname as table_name, a.attname as column_name, a.attnum,
                 format_type(a.atttypid, a.atttypmod) as fmt, t.typname as udt_name, tn.nspname as udt_schema, t.typtype,
                 case when t.typtype = 'e' then 'USER-DEFINED' when t.typcategory = 'A' then 'ARRAY' else format_type(a.atttypid, null) end as data_type,
                 a.attnotnull as notnull, pg_get_expr(d.adbin, d.adrelid) as dflt
          from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
          join pg_type t on t.oid = a.atttypid join pg_namespace tn on tn.oid = t.typnamespace
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where n.nspname = %s and c.relkind in ('r','v','m') and a.attnum > 0 and not a.attisdropped order by 1, 3""", (sc,))
        enums = db.read_df("""select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
          from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = %s group by 1""", (sc,))
        funcs = db.read_df("""select p.proname as name, pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as ret
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = %s and p.prokind = 'f' order by 1""", (sc,))
        out.append(f"  {sc}: {{")
        tables = [r for r in rels.itertuples() if r.kind == "r"]
        views = [r for r in rels.itertuples() if r.kind in ("v", "m")]
        for label, group in (("Tables", tables), ("Views", views)):
            out.append(f"    {label}: {{")
            for r in group:
                cs = cols[cols.table_name == r.name]
                out.append(f"      {r.name}: {{")
                out.append("        Row: {")
                for c in cs.to_dict("records"):
                    ts = _ts(c); null = "" if c["notnull"] else " | null"
                    out.append(f'          {c["column_name"]}: {ts}{null}')
                out.append("        }")
                if label == "Tables":
                    for part in ("Insert", "Update"):
                        out.append(f"        {part}: {{")
                        for c in cs.to_dict("records"):
                            ts = _ts(c); opt = "?" if (part == "Update" or not c["notnull"] or c["dflt"]) else ""
                            null = "" if c["notnull"] else " | null"
                            out.append(f'          {c["column_name"]}{opt}: {ts}{null}')
                        out.append("        }")
                    out.append("        Relationships: []")
                else:
                    out.append("        Relationships: []")
                out.append("      }")
            out.append("    }")
        out.append("    Functions: {")
        for f in funcs.itertuples():
            args = []
            for a in filter(None, [x.strip() for x in (f.args or "").split(",")]):
                nm, _, typ = a.partition(" ")
                base = typ.replace("DEFAULT", "").strip().split(" ")[0]
                tst = {"text": "string", "uuid": "string", "jsonb": "Json", "bigint[]": "number[]", "integer": "number"}.get(base, "unknown")
                args.append(f"{nm}: {tst}")
            ret = {"uuid": "string", "jsonb": "Json", "void": "undefined", "integer": "number"}.get(f.ret, "unknown")
            out.append(f"      {f.name}: {{ Args: {{ {'; '.join(args)} }}; Returns: {ret} }}")
        out.append("    }")
        out.append("    Enums: {")
        for e in enums.itertuples():
            out.append(f"      {e.typname}: " + " | ".join(f'"{l}"' for l in e.labels))
        out.append("    }")
        out.append("    CompositeTypes: Record<string, never>")
        out.append("  }")
    out.append("}")
    return "\n".join(out) + "\n"
