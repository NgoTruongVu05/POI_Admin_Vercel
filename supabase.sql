-- Supabase (Postgres) schema + RLS policies for POI Admin UI
-- Run in Supabase SQL editor.

-- =========================================
-- Tables
-- =========================================

create table if not exists public.pois (
  id text primary key,
  name varchar(200) not null,
  description text not null,
  image TEXT,
  lat double precision not null,
  lng double precision not null,
  priority integer not null default 0 check (priority between 0 and 20),
  user_id uuid references auth.users(id) on delete cascade on update cascade -- owner/manager user id (nullable)
);

create table if not exists public.languages (
  code varchar(10) primary key,
  name varchar(100) not null,
  is_active boolean not null default true
);

create table if not exists public.poitranslations (
  poi_id text not null references public.pois(id) on delete cascade on update cascade,
  lang_code varchar(10) not null references public.languages(code) on delete cascade on update cascade,
  description text null,
  primary key (poi_id, lang_code)
);

create table if not exists public.app_heartbeats (
  client_id text primary key,
  user_id uuid null references auth.users(id) on delete set null,
  actor text not null default 'tourist' check (actor in ('admin', 'manager', 'tourist')),
  app text not null default 'poi-mobile',
  platform text null,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_heartbeats_last_seen on public.app_heartbeats (last_seen desc);

-- =========================================
-- Row Level Security (RLS)
-- Policy: only authenticated users can read/write.
-- (Recommended) Disable public signups in Supabase Auth for an admin-only panel.
-- =========================================

alter table public.pois enable row level security;
alter table public.languages enable row level security;
alter table public.poitranslations enable row level security;
alter table public.app_heartbeats enable row level security;

drop policy if exists "pois_auth_all" on public.pois;
create policy "pois_auth_all" on public.pois
for all
to authenticated
using (true)
with check (true);

-- Index for fast lookup by owner
create index if not exists idx_pois_user_id on public.pois (user_id);

drop policy if exists "languages_auth_all" on public.languages;
create policy "languages_auth_all" on public.languages
for all
to authenticated
using (true)
with check (true);

drop policy if exists "poitranslations_auth_all" on public.poitranslations;
create policy "poitranslations_auth_all" on public.poitranslations
for all
to authenticated
using (true)
with check (true);

-- =========================================
-- Manager roles (Chủ quán / Admin)
-- Stores a readable list of managers + role.
-- Role is also mirrored in Supabase Auth user_metadata.role.
-- =========================================

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_roles_email_unique on public.user_roles (lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

drop trigger if exists trg_app_heartbeats_updated_at on public.app_heartbeats;
create trigger trg_app_heartbeats_updated_at
before update on public.app_heartbeats
for each row execute function public.set_updated_at();

alter table public.user_roles enable row level security;

-- Admin is determined by Supabase Auth JWT user_metadata.role
drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all" on public.user_roles
for all
to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- =========================================
-- Optional seed
-- =========================================

INSERT INTO pois (id, name, description, lat, lng) VALUES
('poi_01', 'Ốc Phát', 'Chuyên các món ốc tươi sống, hải sản đa dạng được chế biến nóng hổi tại chỗ. Menu phong phú, nước chấm độc bản, giá cả cực sinh viên. Ghé ngay Ốc Phát để "lai rai" cùng bạn bè nhé!', 10.761968, 106.70209),
('poi_02', 'Ốc Vũ', 'Tại Ốc Vũ, mỗi món ăn là một sự kết hợp hoàn hảo giữa nguyên liệu tươi sống và công thức sốt độc quyền. Đừng bỏ lỡ món ốc hương sốt hoàng kim béo ngậy hay ốc móng tay xào rau muống giòn tan. Ăn một lần là ghiền!', 10.76141, 106.70270),
('poi_03', 'Đầu Trọc Tiệm Nướng', 'Không gian mở, mồi cực bén, bia cực lạnh. Tại đây chúng tôi có những tảng thịt nướng xèo xèo thơm nức mũi và không khí "anh em một nhà" cực nhiệt. Ghé Đầu Trọc – Ăn no bụng, vui hết nấc!', 10.76149, 106.70247),
('poi_04', 'Lẩu nướng Thuận Việt', 'Tận hưởng sự kết hợp hoàn hảo giữa những khay thịt nướng xèo xèo thơm nức và nồi lẩu nghi ngút khói. Với nguyên liệu tươi sạch mỗi ngày và không gian rộng rãi, Thuận Việt là điểm đến lý tưởng cho những bữa tiệc gia đình, sinh nhật hay họp mặt bạn bè.', 10.76095, 106.70308)

ON CONFLICT DO NOTHING;


insert into public.languages (code, name, is_active)
values
  ('vi', '(VN) Tiếng Việt', true),
  ('en', '(US) English', true),
  ('zh-CN', '(CN) 汉语', true),
  ('ja', '(JP) 日本語', true),
  ('ko', '(KR) 한국어', true),
  ('es', '(ES) Español', true);
on conflict (code) do nothing;

INSERT INTO poitranslations (poiId, langCode, description) VALUES
('poi_01', 'vi', 'Chuyên các món ốc tươi sống, hải sản đa dạng được chế biến nóng hổi tại chỗ. Menu phong phú, nước chấm độc bản, giá cả cực sinh viên. Ghé ngay Ốc Phát để "lai rai" cùng bạn bè nhé!'),
('poi_01', 'en', 'Specializing in fresh snails and a variety of seafood, all prepared hot on the spot. A rich menu, unique dipping sauces, and student-friendly prices. Visit Oc Phat for a great time with your friends!'),
('poi_01', 'zh-CN', '本店专营新鲜蜗牛和各种海鲜，全部现场烹制。菜品种类丰富，蘸酱独特，价格亲民。快来 Oc Phat 和朋友们一起享受美好时光吧！'),
('poi_01', 'ja', '新鮮なカタツムリと様々なシーフードを専門に、すべて注文を受けてから熱々に調理いたします。豊富なメニュー、個性的なつけダレ、そして学生にも優しい価格設定が魅力です。友達と楽しい時間を過ごすなら、ぜひOc Phatへ！'),
('poi_01', 'ko', '신선한 달팽이와 다양한 해산물을 전문으로 하며, 모든 요리는 즉석에서 따뜻하게 조리됩니다. 풍성한 메뉴와 독특한 소스, 그리고 학생들에게도 부담 없는 가격까지! 친구들과 함께 Oc Phat에서 즐거운 시간을 보내세요!'),
('poi_01', 'es', 'Especializados en caracoles frescos y una variedad de mariscos, todos preparados al momento. Un menú variado, salsas únicas y precios accesibles para estudiantes. ¡Visita Oc Phat para una divertida reunión con amigos!'),
('poi_02', 'vi', 'Tại Ốc Vũ, mỗi món ăn là một sự kết hợp hoàn hảo giữa nguyên liệu tươi sống và công thức sốt độc quyền. Đừng bỏ lỡ món ốc hương sốt hoàng kim béo ngậy hay ốc móng tay xào rau muống giòn tan. Ăn một lần là ghiền!'),
('poi_02', 'en', 'At Oc Vu, each dish is a perfect combination of fresh ingredients and our exclusive sauce recipe. Don''t miss the rich and creamy golden sauce sea snails or the crispy stir-fried razor clams with water spinach. One bite and you''ll be hooked!'),
('poi_02', 'zh-CN', '在 Oc Vu，每一道菜都完美融合了新鲜食材和我们独家秘制的酱汁。千万别错过浓郁香滑的金汁海螺，或是酥脆爽口的蛏子炒空心菜。一口下去，你就会爱上它！'),
('poi_02', 'ja', 'Oc Vuでは、どの料理も新鮮な食材と当店特製のソースレシピが見事に調和しています。濃厚でクリーミーな黄金色のソースでいただく巻貝や、空芯菜とカリッと炒めたマテ貝は必食です。一口食べれば、きっと虜になるでしょう！'),
('poi_02', 'ko', '오크부에서는 모든 요리가 신선한 재료와 저희만의 특별한 소스 레시피의 완벽한 조화로 탄생합니다. 진하고 크리미한 황금빛 소스에 버무린 바다 달팽이 요리나 바삭한 맛조개와 모닝글로리 볶음을 꼭 드셔보세요. 한 입 베어 무는 순간, 그 매력에 푹 빠지게 될 거예요!'),
('poi_02', 'es', 'En Oc Vu, cada plato es una combinación perfecta de ingredientes frescos y nuestra salsa exclusiva. No te pierdas los caracoles marinos con salsa dorada, rica y cremosa, ni las navajas salteadas con espinacas de agua. ¡Con solo probarlos, te enamorarás!'),
('poi_03', 'vi', 'Không gian mở, mồi cực bén, bia cực lạnh. Tại đây chúng tôi có những tảng thịt nướng xèo xèo thơm nức mũi và không khí "anh em một nhà" cực nhiệt. Ghé Đầu Trọc – Ăn no bụng, vui hết nấc!'),
('poi_03', 'en', 'Open space, amazing food, ice-cold beer. Here we have sizzling, mouthwatering grilled meats and a super warm, friendly atmosphere. Visit Dau Trok – Eat your fill, have the time of your life!'),
('poi_03', 'zh-CN', '开阔的空间，美味的食物，冰爽的啤酒。这里有滋滋作响、令人垂涎欲滴的烤肉，还有热情友好的氛围。来Dau Trok餐厅吧——尽情享用美食，度过美好时光！'),
('poi_03', 'ja', '広々とした空間、絶品料理、キンキンに冷えたビール。ここでは、ジュージューと音を立てる、食欲をそそるグリル料理と、温かくフレンドリーな雰囲気をお楽しみいただけます。ぜひDau Trokにお越しください。お腹いっぱい食べて、最高の時間をお過ごしください！'),
('poi_03', 'ko', '탁 트인 공간, 맛있는 음식, 시원한 맥주. 지글지글 구워지는 군침 도는 그릴 요리와 따뜻하고 친근한 분위기를 즐겨보세요. 다우 트록에 오셔서 배불리 드시고 최고의 시간을 보내세요!'),
('poi_03', 'es', 'Espacio abierto, comida increíble, cerveza bien fría. Aquí encontrarás carnes a la parrilla chisporroteantes y deliciosas, en un ambiente cálido y acogedor. ¡Visita Dau Trok, come hasta saciarte y pásalo en grande!');
('poi_04', 'vi', 'Tận hưởng sự kết hợp hoàn hảo giữa những khay thịt nướng xèo xèo thơm nức và nồi lẩu nghi ngút khói. Với nguyên liệu tươi sạch mỗi ngày và không gian rộng rãi, Thuận Việt là điểm đến lý tưởng cho những bữa tiệc gia đình, sinh nhật hay họp mặt bạn bè.'),
('poi_04', 'en', 'Enjoy the perfect combination of sizzling, aromatic grilled meat platters and steaming hot pot. With fresh ingredients daily and a spacious environment, Thuan Viet is the ideal destination for family gatherings, birthdays, or friend meetups.'),
('poi_04', 'zh-CN', '尽享滋滋作响、香气四溢的烤肉和热气腾腾的火锅的完美组合。Thuan Viet 每日选用新鲜食材，环境宽敞舒适，是家庭聚会、生日派对或朋友小聚的理想之选。'),
('poi_04', 'ja', '香ばしい焼き肉のジュージューという音と湯気の立つ鍋料理の完璧な組み合わせをお楽しみください。 毎日新鮮な食材と広々とした空間で、Thuan Vietは家族の集まり、誕生日、友人との集まりに最適な場所です。'),
('poi_04', 'ko', '지글지글 맛있는 바비큐 트레이와 김이 모락모락 나는 핫팟의 완벽한 조화를 즐겨보세요. 신선한 재료와 넓은 공간으로 매일 준비되는 투언 비엣은 가족 모임, 생일 또는 친구 모임에 이상적인 장소입니다.'),
('poi_04', 'es', 'Disfruta de la combinación perfecta de bandejas de barbacoa chisporroteantes y fragantes y ollas de hot pot humeantes. Con ingredientes frescos cada día y un espacio amplio, Thuan Viet es el destino ideal para fiestas familiares, cumpleaños o reuniones de amigos.'),

ON CONFLICT DO NOTHING;


