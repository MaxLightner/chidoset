-- Registered legacy swatches stay on GitHub until an operator uploads their managed replacements.
-- Canonical albedo_path/thumb_path remain relative Supabase bucket paths (or NULL).
alter table public.material_swatches add column if not exists legacy_albedo_path text;
alter table public.material_swatches add column if not exists legacy_thumb_path text;
alter table public.material_swatches add column if not exists legacy_source text;
insert into public.material_families(code,name,kind,scope,tile_cm,roughness_factor)
values ('SHD-FAB-001','پارچه‌های فعلی چیدو','fabric','shared',35,.85),
 ('SHD-WOD-001','چوب‌های فعلی چیدو','wood','shared',70,.55)
on conflict(code) do nothing;
insert into public.material_swatches(family_id,code,name,hex_color,legacy_albedo_path,legacy_thumb_path,legacy_source)
select f.id,v.code,v.name,v.hex_color,v.path,v.thumb,v.source
from (values
 ('SHD-FAB-001','SHD-FAB-001-01','آبی تیره','#374151','assets/chido/dark-fabric.jpg','assets/library/materials/fabric/legacy-fabric-dark/thumbnail.jpg','fabric:dark'),
 ('SHD-FAB-001','SHD-FAB-001-02','کرم','#D6C7B2','assets/chido/creme-fabric.jpg','assets/library/materials/fabric/legacy-fabric-creme/thumbnail.jpg','fabric:creme'),
 ('SHD-FAB-001','SHD-FAB-001-03','خاکستری','#9CA3AF','assets/chido/gray-fabric.jpg','assets/library/materials/fabric/legacy-fabric-gray/thumbnail.jpg','fabric:gray'),
 ('SHD-WOD-001','SHD-WOD-001-01','بلوط روشن','#AE824D','assets/chido/wood-oak.jpg','assets/library/materials/wood/legacy-wood-oak/thumbnail.jpg','wood:oak'),
 ('SHD-WOD-001','SHD-WOD-001-02','گردویی','#5F3A23','assets/chido/wood-walnut.jpg','assets/library/materials/wood/legacy-wood-walnut/thumbnail.jpg','wood:walnut'),
 ('SHD-WOD-001','SHD-WOD-001-03','چوب تیره','#2C2724','assets/chido/wood-black.jpg','assets/library/materials/wood/legacy-wood-black/thumbnail.jpg','wood:black')
) as v(family,code,name,hex_color,path,thumb,source)
join public.material_families f on f.code=v.family
on conflict(code) do nothing;