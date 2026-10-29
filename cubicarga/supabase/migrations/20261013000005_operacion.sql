alter table calculos add column version_de uuid references calculos(id);
alter table calculos add column numero_version integer not null default 1 check(numero_version>0);
create index calculos_version_de_idx on calculos(version_de,created_at);
create table plantillas_carga (
 id uuid primary key default gen_random_uuid(),empresa_id uuid not null references empresas(id),
 nombre text not null check(length(trim(nombre)) between 1 and 120),entrada_json jsonb not null,
 creado_por uuid references auth.users(id),created_at timestamptz not null default now()
);
alter table plantillas_carga enable row level security;
create policy plantillas_ver on plantillas_carga for select using(empresa_id=mi_empresa());
create policy plantillas_editar on plantillas_carga for all using(empresa_id=mi_empresa() and puede_editar()) with check(empresa_id=mi_empresa() and puede_editar());
create function guardar_version(p_base uuid,p_nombre text,p_plan jsonb,p_entrada jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare raiz uuid; proyecto uuid; nuevo uuid; version integer;
begin
 if auth.uid() is null or not puede_editar() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 select coalesce(version_de,id),proyecto_id into raiz,proyecto from calculos where id=p_base;
 if raiz is null then raise exception 'Cálculo no encontrado' using errcode='42501'; end if;
 perform 1 from calculos where id=raiz for update;
 select coalesce(max(numero_version),1)+1 into version from calculos where id=raiz or version_de=raiz;
 insert into calculos(proyecto_id,nombre_escenario,plan_json,entrada_json,version_motor,resumen,version_de,numero_version)
 values(proyecto,p_nombre,p_plan,p_entrada,p_plan->>'versionMotor',p_plan->'kpis',raiz,version) returning id into nuevo;
 return nuevo;
end $$;
revoke execute on function guardar_version(uuid,text,jsonb,jsonb) from public;
grant execute on function guardar_version(uuid,text,jsonb,jsonb) to authenticated;
-- El plan guardado es una versión; restaurar crea otra, nunca sobrescribe el original.
create function proteger_snapshot_calculo() returns trigger language plpgsql set search_path=public as $$
begin
 if new.version_de is not null and not exists(select 1 from calculos c where c.id=new.version_de and c.proyecto_id=new.proyecto_id and c.version_de is null) then
  raise exception 'La versión original no pertenece al proyecto' using errcode='42501';
 end if;
 if tg_op='UPDATE' and auth.uid() is not null and (new.plan_json is distinct from old.plan_json or new.entrada_json is distinct from old.entrada_json or new.version_de is distinct from old.version_de or new.numero_version is distinct from old.numero_version) then
  raise exception 'Crea una nueva versión para modificar el cálculo' using errcode='42501';
 end if;
 return new;
end $$;
create trigger snapshot_calculo_inmutable before insert or update on calculos for each row execute function proteger_snapshot_calculo();
