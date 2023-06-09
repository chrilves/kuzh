create schema kuzh;

create table "kuzh.rooms" (
    /* Rooms are identified by public key but join by is cheaper */
    id serial not null primary key check (id >= 0),
    created_on timestamptz not null default now(),
    alive_on timestamptz not null default now(),
    public_key bytea unique not null check (length(public_key) = 32),
    secret_key bytea unique not null check (length(public_key) = 32)
);

create unique index on "kuzh.rooms"(public_key);

create table "kuzh.room_blocks"(
    room      serial not null references "kuzh.rooms"(id) on delete cascade,
    height    integer not null check (height >= 0),
    timestamp timestamptz not null default now(),
    api       integer not null check (api >= 0),
    block     bytea not null,
    question  integer null check (question > 0),
    primary key (room, height)
);

create table "kuzh.answering_blocks"(
    room      serial not null references "kuzh.rooms"(id) on delete cascade,
    question  integer not null check (question > 0),
    height    integer not null check (height >= 0),
    timestamp timestamptz not null default now(),
    api       integer not null check (api >= 0),
    block     bytea not null,
    primary key (room, question, height)
);

create unique index on "kuzh.answering_blocks"(room, question asc, height asc);

create type transaction_status as enum ('committed', 'rejected', 'accepted', 'included');

create table "kuzh.transaction_log"(
    room        serial not null references "kuzh.rooms"(id) on delete cascade,
    id          integer not null check (id >= 0),
    timestamp   timestamptz not null default now(),
    user_id     integer not null check (user_id >= 0),
    hash        bytea unique not null check (length(hash) = 32),
    api         integer not null check (api >= 0),
    transaction bytea not null,
    status      transaction_status not null default 'committed',
    primary key (room, id)
);

create unique index on "kuzh.transaction_log"(room, id asc);
create index on "kuzh.transaction_log"(status);

create table "kuzh.room_state"(
    room      serial not null references "kuzh.rooms"(id) on delete cascade,
    height    integer not null check (height >= 0),
    api       integer not null check (api >= 0),
    state     bytea not null,
    primary key (room, height)
);

create table "kuzh.answering_state"(
    room      serial not null references "kuzh.rooms"(id) on delete cascade,
    question  integer not null check (question > 0),
    height    integer not null check (height >= 0),
    api       integer not null check (api >= 0),
    state     bytea not null,
    primary key (room, height, question)
);