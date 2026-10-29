alter table calculos add column plan_json jsonb;
alter table calculos add column entrada_json jsonb;
create function guardar_calculo(p_nombre text,p_plan jsonb,p_entrada jsonb,p_proyecto uuid default null) returns uuid
language plpgsql security invoker set search_path=public as $$
declare proyecto uuid; calculo uuid;
begin
 if auth.uid() is null or mi_empresa() is null or not puede_editar() then raise exception 'Acceso no autorizado' using errcode='42501'; end if;
 proyecto:=p_proyecto;
 if proyecto is null then
  insert into proyectos (empresa_id,creado_por,nombre) values(mi_empresa(),auth.uid(),p_nombre) returning id into proyecto;
 end if;
 insert into calculos (proyecto_id,nombre_escenario,plan_json,entrada_json,version_motor,resumen) values(proyecto,p_nombre,p_plan,p_entrada,p_plan->>'versionMotor',p_plan->'kpis') returning id into calculo;
 return calculo;
end $$;
revoke execute on function guardar_calculo(text,jsonb,jsonb,uuid) from public;
grant execute on function guardar_calculo(text,jsonb,jsonb,uuid) to authenticated;
-- Proyección pública incluso si se llama al RPC directamente (sin pasar por Next).
create function filtrar_campos_plan(p_obj jsonb,p_campos text[]) returns jsonb
language sql immutable set search_path=public as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p_obj) where key=any(p_campos)
$$;
create function filtrar_array_plan(p_items jsonb,p_campos text[]) returns jsonb
language sql immutable set search_path=public as $$
 select coalesce(jsonb_agg(filtrar_campos_plan(value,p_campos)),'[]'::jsonb) from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
$$;
create function proyeccion_plan_publico(p jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select filtrar_campos_plan(p,array['versionMotor','semilla','kpis','avisos','parametros','noCargados']) || jsonb_build_object(
  'materiales',filtrar_array_plan(p->'materiales',array['id','sku','nombre','largo','ancho','alto','peso','orientaciones','apilable','maxPesoEncima','maxCapas','fragil','paradaDescarga','color']),
  'equipos',filtrar_array_plan(p->'equipos',array['id','codigo','nombre','categoria','largo','ancho','alto','alturaUtil','puertaAncho','puertaAlto','cargaUtil','tieneTecho','tieneParedes']),
  'tarimas',filtrar_array_plan(p->'tarimas',array['id','nombre','largo','ancho','alto','tara','cargaMax','alturaMaxArmada','voladizoMax','material']),
  'colocaciones',filtrar_array_plan(p->'colocaciones',array['equipoIdx','materialId','tarimaIdx','x','y','z','l','a','h','orientacion','paso','capa']),
  'tarimasArmadas',filtrar_array_plan(p->'tarimasArmadas',array['equipoIdx','tarimaId','x','y','z','l','a','h','hTarima','peso','cajas','paso','offset'])
 )
$$;
revoke execute on function filtrar_campos_plan(jsonb,text[]) from public;
revoke execute on function filtrar_array_plan(jsonb,text[]) from public;
revoke execute on function proyeccion_plan_publico(jsonb) from public;
-- El token es la capacidad de lectura. No se concede SELECT anónimo a tablas.
create function obtener_plan_compartido(p_token text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('nombre',c.nombre_escenario,'plan',proyeccion_plan_publico(c.plan_json),'expira',l.expira_at)
 from links_compartidos l join calculos c on c.id=l.calculo_id
 where l.token=p_token and l.activo and l.expira_at>now() and length(p_token)=32
 limit 1
$$;
revoke execute on function obtener_plan_compartido(text) from public;
grant execute on function obtener_plan_compartido(text) to anon,authenticated;

-- NOT VALID conserva registros históricos; la restricción sí se exige a nuevas escrituras.
alter table equipos add constraint equipos_medidas_positivas check (
 largo_int_mm between 1 and 20000 and ancho_int_mm between 1 and 20000 and alto_int_mm between 1 and 20000 and altura_util_mm between 1 and alto_int_mm and puerta_ancho_mm between 1 and 20000 and puerta_alto_mm between 1 and 20000 and (carga_util_kg is null or carga_util_kg>0)
) not valid;
alter table tarimas add constraint tarimas_carga_positiva check(tara_kg>=0 and carga_max_kg>0 and altura_max_armada_mm>=alto_mm and voladizo_max_mm>=0) not valid;
