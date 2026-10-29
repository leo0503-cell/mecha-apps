-- Endurecimiento aditivo: no elimina tablas, columnas ni políticas previas.
-- Las políticas permisivas se combinan con OR: la integridad se impone con triggers.
create function proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor rol_usuario; empresa uuid;
begin
  if auth.uid() is null then return new; end if; -- migraciones/fixtures, no rol API
  select rol, empresa_id into actor, empresa from perfiles where id = auth.uid();
  if actor = 'superadmin' then return new; end if;
  if new.empresa_id is distinct from old.empresa_id or new.empresa_id is distinct from empresa then
    raise exception 'No puedes cambiar la empresa del perfil' using errcode = '42501';
  end if;
  if new.rol = 'superadmin' or old.rol = 'superadmin' or
     (old.id = auth.uid() and new.rol is distinct from old.rol) or
     (actor is distinct from 'admin' and (old.id <> auth.uid() or new.rol is distinct from old.rol)) then
    raise exception 'No puedes elevar los permisos del perfil' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_perfil_update before update on perfiles
for each row execute function proteger_perfil();

create function proteger_proyecto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and new.empresa_id is distinct from old.empresa_id then
    raise exception 'No puedes transferir un proyecto entre empresas' using errcode = '42501';
  end if;
  if new.estado = 'aprobado' and not es_admin() then
    raise exception 'Solo un administrador puede aprobar proyectos' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_proyecto_escritura before insert or update on proyectos
for each row execute function proteger_proyecto();

create function proteger_hijo_proyecto() returns trigger
language plpgsql security definer set search_path = public as $$
declare emp uuid; estado_padre estado_proyecto; registro record; anterior_estado estado_proyecto; equipo_id uuid;
begin
  if tg_op = 'DELETE' then registro := old; else registro := new; end if;
  select empresa_id, estado into emp, estado_padre from proyectos where id = registro.proyecto_id;
  if emp is null then raise exception 'Proyecto inexistente' using errcode = '23503'; end if;
  if auth.uid() is not null then
    if emp is distinct from mi_empresa() or not puede_editar() then
      raise exception 'No tienes permiso sobre este proyecto' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' then
      select estado into anterior_estado from proyectos where id = old.proyecto_id;
    end if;
    if (estado_padre = 'aprobado' or anterior_estado = 'aprobado') and not es_admin() then
      raise exception 'Solo un administrador puede modificar un proyecto aprobado' using errcode = '42501';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if tg_table_name = 'proyecto_items' then
      if not exists (select 1 from materiales m where m.id = new.material_id and (m.empresa_id is null or m.empresa_id = emp)) then
        raise exception 'El material no pertenece a la empresa del proyecto' using errcode = '42501';
      end if;
    elsif tg_table_name = 'calculos' then
      if new.tarima_id is not null and not exists (select 1 from tarimas t where t.id = new.tarima_id and (t.empresa_id is null or t.empresa_id = emp)) then
        raise exception 'La tarima no pertenece a la empresa del proyecto' using errcode = '42501';
      end if;
      foreach equipo_id in array new.equipos_permitidos loop
        if not exists (select 1 from equipos e where e.id = equipo_id and (e.empresa_id is null or e.empresa_id = emp)) then
          raise exception 'El equipo no pertenece a la empresa del proyecto' using errcode = '42501';
        end if;
      end loop;
    end if;
  end if;
  return registro;
end $$;
create trigger proteger_items before insert or update or delete on proyecto_items
for each row execute function proteger_hijo_proyecto();
create trigger proteger_calculos before insert or update or delete on calculos
for each row execute function proteger_hijo_proyecto();
