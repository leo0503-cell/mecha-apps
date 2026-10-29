-- Aditiva: protege identidades y pertenencia de snapshots sin modificar datos.
create function proteger_identidad_registro() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.id is distinct from old.id then
    raise exception 'No puedes cambiar la identidad del registro' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger perfiles_identidad before update on perfiles
for each row execute function proteger_identidad_registro();
create trigger proyectos_identidad before update on proyectos
for each row execute function proteger_identidad_registro();
create trigger calculos_identidad before update on calculos
for each row execute function proteger_identidad_registro();

create function proteger_pertenencia_snapshot() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and new.proyecto_id is distinct from old.proyecto_id then
    raise exception 'Un snapshot no se puede mover a otro proyecto; crea una versión nueva' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger calculos_pertenencia before update on calculos
for each row execute function proteger_pertenencia_snapshot();
