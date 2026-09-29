create extension if not exists pgcrypto with schema extensions;

create table slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  slot_time time not null,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint one_slot_per_day unique (slot_date) -- quitar esta línea para permitir varias citas al día
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots(id),
  student_name text not null check (char_length(trim(student_name)) between 1 and 80),
  cancel_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
-- Protección real contra reservas duplicadas: solo una reserva activa por hueco
create unique index one_active_booking_per_slot on bookings(slot_id) where status = 'confirmed';

alter table slots enable row level security;
alter table bookings enable row level security;
-- El público NO accede a las tablas; solo el administrador autenticado
create policy admin_slots on slots for all to authenticated using (true) with check (true);
create policy admin_bookings on bookings for all to authenticated using (true) with check (true);

-- Disponibilidad pública (sin nombres)
create function get_availability()
returns table(id uuid, slot_date date, slot_time time, booked boolean)
language sql security definer set search_path = public as $$
  select s.id, s.slot_date, s.slot_time,
         exists(select 1 from bookings b where b.slot_id = s.id and b.status = 'confirmed')
  from slots s
  where not s.is_blocked
    and (s.slot_date + s.slot_time) > (now() at time zone 'Europe/Lisbon')
$$;

create function book_slot(p_slot uuid, p_name text)
returns table(o_token text, o_date date, o_time time, o_name text)
language plpgsql security definer set search_path = public as $$
declare s slots; b bookings;
begin
  select * into s from slots
   where id = p_slot and not is_blocked
     and (slot_date + slot_time) > (now() at time zone 'Europe/Lisbon');
  if not found then raise exception 'not_available'; end if;
  begin
    insert into bookings(slot_id, student_name) values (p_slot, trim(p_name)) returning * into b;
  exception when unique_violation then raise exception 'taken';
  end;
  return query select b.cancel_token, s.slot_date, s.slot_time, b.student_name;
end $$;

create function get_booking(p_token text)
returns table(o_name text, o_date date, o_time time, o_status text)
language sql security definer set search_path = public as $$
  select b.student_name, s.slot_date, s.slot_time, b.status
  from bookings b join slots s on s.id = b.slot_id where b.cancel_token = p_token
$$;

create function cancel_booking(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'cancelled', cancelled_at = now()
   where cancel_token = p_token and status = 'confirmed';
  return found;
end $$;
