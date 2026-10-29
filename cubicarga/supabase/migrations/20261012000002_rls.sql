-- RLS por empresa_id (sección 12). Catálogos globales: lectura para todos,
-- escritura solo superadmin.

create or replace function mi_empresa() returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid()
$$;

create or replace function mi_rol() returns rol_usuario language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

create or replace function es_superadmin() returns boolean language sql stable as $$
  select coalesce(mi_rol() = 'superadmin', false)
$$;

create or replace function puede_editar() returns boolean language sql stable as $$
  select coalesce(mi_rol() in ('planeador', 'admin', 'superadmin'), false)
$$;

create or replace function es_admin() returns boolean language sql stable as $$
  select coalesce(mi_rol() in ('admin', 'superadmin'), false)
$$;

alter table empresas enable row level security;
alter table perfiles enable row level security;
alter table materiales enable row level security;
alter table tarimas enable row level security;
alter table equipos enable row level security;
alter table transportistas enable row level security;
alter table almacenes enable row level security;
alter table racks enable row level security;
alter table proyectos enable row level security;
alter table proyecto_items enable row level security;
alter table calculos enable row level security;
alter table links_compartidos enable row level security;
alter table auditoria enable row level security;

-- Empresas y perfiles
create policy empresas_ver on empresas for select using (id = mi_empresa() or es_superadmin());
create policy empresas_admin on empresas for update using ((id = mi_empresa() and es_admin()) or es_superadmin());
create policy perfiles_ver on perfiles for select using (id = auth.uid() or empresa_id = mi_empresa() or es_superadmin());
create policy perfiles_yo on perfiles for update using (id = auth.uid()) with check (id = auth.uid() and rol = mi_rol() and empresa_id is not distinct from mi_empresa());
create policy perfiles_admin on perfiles for update using ((empresa_id = mi_empresa() and es_admin()) or es_superadmin());

-- Catálogos con global (empresa_id null): materiales, tarimas, equipos
do $$
declare t text;
begin
  foreach t in array array['materiales', 'tarimas', 'equipos'] loop
    execute format('create policy %1$s_ver on %1$s for select using (empresa_id is null or empresa_id = mi_empresa() or es_superadmin())', t);
    execute format('create policy %1$s_global on %1$s for all using (empresa_id is null and es_superadmin()) with check (empresa_id is null and es_superadmin())', t);
  end loop;
end $$;

-- Materiales: los administra el planeador. Tarimas y equipos propios: el admin.
create policy materiales_empresa on materiales for all
  using (empresa_id = mi_empresa() and puede_editar()) with check (empresa_id = mi_empresa() and puede_editar());
create policy tarimas_empresa on tarimas for all
  using (empresa_id = mi_empresa() and es_admin()) with check (empresa_id = mi_empresa() and es_admin());
create policy equipos_empresa on equipos for all
  using (empresa_id = mi_empresa() and es_admin()) with check (empresa_id = mi_empresa() and es_admin());

-- Solo de empresa: transportistas y almacenes (admin escribe, todos leen)
create policy transportistas_ver on transportistas for select using (empresa_id = mi_empresa());
create policy transportistas_admin on transportistas for all using (empresa_id = mi_empresa() and es_admin()) with check (empresa_id = mi_empresa() and es_admin());
create policy almacenes_ver on almacenes for select using (empresa_id = mi_empresa());
create policy almacenes_admin on almacenes for all using (empresa_id = mi_empresa() and es_admin()) with check (empresa_id = mi_empresa() and es_admin());
create policy racks_ver on racks for select using (exists (select 1 from almacenes a where a.id = almacen_id and a.empresa_id = mi_empresa()));
create policy racks_admin on racks for all
  using (es_admin() and exists (select 1 from almacenes a where a.id = almacen_id and a.empresa_id = mi_empresa()))
  with check (es_admin() and exists (select 1 from almacenes a where a.id = almacen_id and a.empresa_id = mi_empresa()));

-- Proyectos y cálculos: visor lee, planeador/admin escriben. Un aprobado solo lo toca el admin.
create policy proyectos_ver on proyectos for select using (empresa_id = mi_empresa());
create policy proyectos_crear on proyectos for insert with check (empresa_id = mi_empresa() and puede_editar());
create policy proyectos_editar on proyectos for update
  using (empresa_id = mi_empresa() and puede_editar() and (estado <> 'aprobado' or es_admin()));
create policy proyectos_borrar on proyectos for delete using (empresa_id = mi_empresa() and es_admin());

create policy items_ver on proyecto_items for select using (exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()));
create policy items_editar on proyecto_items for all
  using (puede_editar() and exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()))
  with check (puede_editar() and exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()));

create policy calculos_ver on calculos for select using (exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()));
create policy calculos_editar on calculos for all
  using (puede_editar() and exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()))
  with check (puede_editar() and exists (select 1 from proyectos p where p.id = proyecto_id and p.empresa_id = mi_empresa()));

-- Links: los crea el planeador; los revoca el admin. La vista pública pasa por la Edge Function
-- (service role), nunca por esta tabla.
create policy links_ver on links_compartidos for select using (exists (
  select 1 from calculos c join proyectos p on p.id = c.proyecto_id where c.id = calculo_id and p.empresa_id = mi_empresa()));
create policy links_crear on links_compartidos for insert with check (puede_editar() and exists (
  select 1 from calculos c join proyectos p on p.id = c.proyecto_id where c.id = calculo_id and p.empresa_id = mi_empresa()));
create policy links_revocar on links_compartidos for update using (es_admin() and exists (
  select 1 from calculos c join proyectos p on p.id = c.proyecto_id where c.id = calculo_id and p.empresa_id = mi_empresa()));

-- Auditoría: solo lectura para admin; se escribe con triggers.
create policy auditoria_ver on auditoria for select using ((empresa_id = mi_empresa() and es_admin()) or es_superadmin());

create or replace function auditar() returns trigger language plpgsql security definer set search_path = public as $$
declare fila jsonb; emp uuid;
begin
  fila := to_jsonb(coalesce(new, old));
  emp := nullif(fila ->> 'empresa_id', '')::uuid;
  -- En proyectos solo se audita cuando están aprobados.
  if tg_table_name = 'proyectos' then
    if coalesce(to_jsonb(old) ->> 'estado', '') <> 'aprobado' and coalesce(to_jsonb(new) ->> 'estado', '') <> 'aprobado' then
      return coalesce(new, old);
    end if;
  end if;
  insert into auditoria (empresa_id, usuario_id, accion, entidad, entidad_id, datos)
  values (emp, auth.uid(), lower(tg_op), tg_table_name, (fila ->> 'id')::uuid,
          jsonb_build_object('antes', case when tg_op <> 'INSERT' then to_jsonb(old) end, 'despues', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;

create trigger aud_materiales after insert or update or delete on materiales for each row execute function auditar();
create trigger aud_tarimas after insert or update or delete on tarimas for each row execute function auditar();
create trigger aud_equipos after insert or update or delete on equipos for each row execute function auditar();
create trigger aud_transportistas after insert or update or delete on transportistas for each row execute function auditar();
create trigger aud_proyectos after update or delete on proyectos for each row execute function auditar();

-- Storage: planes JSON, PDFs y logos, por carpeta de empresa.
insert into storage.buckets (id, name, public) values ('planes', 'planes', false), ('reportes', 'reportes', false), ('logos', 'logos', true)
on conflict (id) do nothing;
create policy storage_empresa_ver on storage.objects for select
  using (bucket_id in ('planes', 'reportes') and (storage.foldername(name))[1] = mi_empresa()::text);
create policy storage_empresa_subir on storage.objects for insert
  with check (bucket_id in ('planes', 'reportes', 'logos') and (storage.foldername(name))[1] = mi_empresa()::text and puede_editar());
