--
-- PostgreSQL database dump
--

\restrict jAGx5yBQUWH7TCeuF7kggmCLUDwshl7CH9qU9vl0Ii1f3BWVPwDFs5m1zndQAYE

-- Dumped from database version 15.18 (Debian 15.18-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: OverrideMode; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OverrideMode" AS ENUM (
    'GRANT',
    'DENY'
);


ALTER TYPE public."OverrideMode" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'USER'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'PENDING'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id text NOT NULL,
    actor_id text,
    module text NOT NULL,
    action text NOT NULL,
    subject_type text,
    subject_id text,
    description text NOT NULL,
    properties jsonb,
    ip_address text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    type text DEFAULT 'string'::text NOT NULL,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    type_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: media; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media (
    id text NOT NULL,
    user_id text NOT NULL,
    filename text NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    size integer NOT NULL,
    bucket text NOT NULL,
    path text NOT NULL,
    url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.media OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: permission_modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permission_modules (
    id text NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.permission_modules OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    module_id text NOT NULL,
    action text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    role_id text NOT NULL,
    permission_id text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: setting_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.setting_fields (
    id text NOT NULL,
    field_name text NOT NULL,
    slug text NOT NULL,
    input_type text NOT NULL,
    value text,
    alt_text text,
    options text,
    type_id text NOT NULL,
    category_id text,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.setting_fields OWNER TO postgres;

--
-- Name: types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.types (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.types OWNER TO postgres;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    user_id text NOT NULL,
    permission_id text NOT NULL,
    mode public."OverrideMode" NOT NULL
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id text NOT NULL,
    role_id text NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    avatar_media_id text,
    deleted_at timestamp(3) without time zone,
    last_login_at timestamp(3) without time zone,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
acbb6747-f30f-40d7-9e80-1caf89180312	205881e9edca082ae6950038e34c1869cb17341e9c161b288e67b5c53973cd0f	2026-07-03 07:14:27.724148+00	20260702000000_add_password_reset_tokens		\N	2026-07-03 07:14:27.724148+00	0
758bdd63-b0a6-4299-b7cc-57a1a90fe60f	ca3be9e5009b07ff0deee15fac5279fd5d88424ee34326aac3ec6e87f562bcec	2026-07-03 07:16:11.764613+00	20260601000000_init		\N	2026-07-03 07:16:11.764613+00	0
2e3a59fc-81f5-413f-8291-be0091a7acc7	1461f82bdfff1434661fff3110482fdfe1a49197555477e9a911b394c7ee4075	2026-07-03 07:16:12.406142+00	20260703071437_user_management_rbac_schema		\N	2026-07-03 07:16:12.406142+00	0
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activity_logs (id, actor_id, module, action, subject_type, subject_id, description, properties, ip_address, created_at) FROM stdin;
cmr8s6ogy000d01pmfzxn8kiz	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8s6ogt000c01pmqg5pxx1v	Role "E2E Viewer mr8s6o7u-9246" created	{"name": "E2E Viewer mr8s6o7u-9246", "slug": "e2e-viewer-mr8s6o7u-9246", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:192.168.65.1	2026-07-06 05:30:03.49
cmr8s6onr000f01pmnobqvefc	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s6onl000e01pm3f6bhtzb	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8s6o7u-9246@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:30:03.735
cmr8s6oou000g01pmre1wnnse	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s6onl000e01pm3f6bhtzb	deleted	{"id": "cmr8s6onl000e01pm3f6bhtzb"}	::ffff:192.168.65.1	2026-07-06 05:30:03.774
cmr8s6op3000h01pm45i4n2p9	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8s6ogt000c01pmqg5pxx1v	Role "E2E Viewer mr8s6o7u-9246" deleted	{"name": "E2E Viewer mr8s6o7u-9246", "slug": "e2e-viewer-mr8s6o7u-9246"}	::ffff:192.168.65.1	2026-07-06 05:30:03.783
cmr8s71bc000k01pmybbkmzw0	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s71b8000j01pm0ux1p0z5	created	{"name": "Shape Probe", "email": "shape-probe-1@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:30:20.136
cmr8s7uuj000n01pmngejhv1x	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8s7uug000m01pmklgzz5rs	Role "E2E Viewer mr8s7ult-3556" created	{"name": "E2E Viewer mr8s7ult-3556", "slug": "e2e-viewer-mr8s7ult-3556", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:192.168.65.1	2026-07-06 05:30:58.411
cmr8s7v12000p01pm4k3g5e4r	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s7v0z000o01pmo4kqhzs7	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8s7ult-3556@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:30:58.646
cmr8s7v1g000q01pm4d1c25jo	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8s7v0z000o01pmo4kqhzs7	updated	{"role_ids": ["cmr8s7uug000m01pmklgzz5rs"]}	::ffff:192.168.65.1	2026-07-06 05:30:58.66
cmr8s7vv3000t01pmlrxouvta	cmr8s7v0z000o01pmo4kqhzs7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:30:59.727
cmr8s7vvf000u01pmtw1rx8se	cmr8s7v0z000o01pmo4kqhzs7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:30:59.739
cmr8s7vvf000v01pmk2gda84r	cmr8s7v0z000o01pmo4kqhzs7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:30:59.739
cmr8s7w36000x01pmscfgf19q	cmr8s7v0z000o01pmo4kqhzs7	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:31:00.018
cmr8s7w3a000y01pm5xa5j8z4	cmr8s7v0z000o01pmo4kqhzs7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:31:00.022
cmr8s7w3b000z01pmolibfjpn	cmr8s7v0z000o01pmo4kqhzs7	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:31:00.023
cmr8s7w3b001001pmiucg41tq	cmr8s7v0z000o01pmo4kqhzs7	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:31:00.023
cmr8s7w4d001201pmwgkxfs4m	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8s7w4a001101pmlx2yi0we	Role "E2E Bypass mr8s7ult-3556" created	{"name": "E2E Bypass mr8s7ult-3556", "slug": "e2e-bypass-mr8s7ult-3556", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:31:00.061
cmr8s7w4j001301pmgn2jt8op	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8s7w4a001101pmlx2yi0we	Role "E2E Bypass mr8s7ult-3556" deleted	{"name": "E2E Bypass mr8s7ult-3556", "slug": "e2e-bypass-mr8s7ult-3556"}	::ffff:192.168.65.1	2026-07-06 05:31:00.067
cmr8s7wav001501pmojbpx6wq	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s7wat001401pmj3dxy1t9	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8s7ult-3556@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:31:00.295
cmr8s7whg001701pmbcmq6umv	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8s7wat001401pmj3dxy1t9	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:31:00.532
cmr8s7wp0001901pmdhp0bycn	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s7wox001801pmbc27i3mo	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8s7ult-3556@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:31:00.804
cmr8s7wp6001a01pmjkm0vdvc	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s7wox001801pmbc27i3mo	deleted	{"id": "cmr8s7wox001801pmbc27i3mo"}	::ffff:192.168.65.1	2026-07-06 05:31:00.81
cmr8s80oh001b01pmlj9j9sc3	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s7v0z000o01pmo4kqhzs7	deleted	{"id": "cmr8s7v0z000o01pmo4kqhzs7"}	::ffff:192.168.65.1	2026-07-06 05:31:05.969
cmr8s80oq001c01pml5fgz573	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s7wat001401pmj3dxy1t9	deleted	{"id": "cmr8s7wat001401pmj3dxy1t9"}	::ffff:192.168.65.1	2026-07-06 05:31:05.978
cmr8s95ud001f01pmlqbal2cn	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8s95ub001e01pm2hlowge3	Role "E2E Viewer mr8s95lm-2541" created	{"name": "E2E Viewer mr8s95lm-2541", "slug": "e2e-viewer-mr8s95lm-2541", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:192.168.65.1	2026-07-06 05:31:59.317
cmr8s960u001h01pmq87trmjv	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s960r001g01pm8ewzxz6n	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8s95lm-2541@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:31:59.55
cmr8s9616001i01pmxdtlat53	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8s960r001g01pm8ewzxz6n	updated	{"role_ids": ["cmr8s95ub001e01pm2hlowge3"]}	::ffff:192.168.65.1	2026-07-06 05:31:59.562
cmr8s96le001l01pmxjbp0r0l	cmr8s960r001g01pm8ewzxz6n	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:32:00.29
cmr8s96lo001m01pmeu73op1i	cmr8s960r001g01pm8ewzxz6n	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:32:00.3
cmr8s96lo001n01pmqu544oi9	cmr8s960r001g01pm8ewzxz6n	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:32:00.3
cmr8s96ud001p01pmvj6b0822	cmr8s960r001g01pm8ewzxz6n	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:32:00.613
cmr8s96uf001q01pmnf3llp6y	cmr8s960r001g01pm8ewzxz6n	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:32:00.615
cmr8s96uh001r01pmyk022p5n	cmr8s960r001g01pm8ewzxz6n	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:32:00.617
cmr8s96ve001u01pmg1tqzm2n	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8s96vc001t01pm7b3qa9kj	Role "E2E Bypass mr8s95lm-2541" created	{"name": "E2E Bypass mr8s95lm-2541", "slug": "e2e-bypass-mr8s95lm-2541", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:32:00.65
cmr8s96vj001v01pmrsn6nzs7	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8s96vc001t01pm7b3qa9kj	Role "E2E Bypass mr8s95lm-2541" deleted	{"name": "E2E Bypass mr8s95lm-2541", "slug": "e2e-bypass-mr8s95lm-2541"}	::ffff:192.168.65.1	2026-07-06 05:32:00.655
cmr8s971y001x01pmlzwc5jus	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s971v001w01pmecjlzkcu	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8s95lm-2541@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:32:00.886
cmr8s978h001z01pmg4csfnxf	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8s971v001w01pmecjlzkcu	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:32:01.121
cmr8s97g1002101pmlynyqrbm	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8s97fy002001pm4nsp4vx9	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8s95lm-2541@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:32:01.393
cmr8s97g7002201pm9trf8fxl	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s97fy002001pm4nsp4vx9	deleted	{"id": "cmr8s97fy002001pm4nsp4vx9"}	::ffff:192.168.65.1	2026-07-06 05:32:01.399
cmr8s97k1002301pm09c9rg1p	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s960r001g01pm8ewzxz6n	deleted	{"id": "cmr8s960r001g01pm8ewzxz6n"}	::ffff:192.168.65.1	2026-07-06 05:32:01.537
cmr8s97k6002401pmbbl1c95n	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s971v001w01pmecjlzkcu	deleted	{"id": "cmr8s971v001w01pmecjlzkcu"}	::ffff:192.168.65.1	2026-07-06 05:32:01.542
cmr8s96uh001s01pm6ldzul2f	cmr8s960r001g01pm8ewzxz6n	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:32:00.617
cmr8s9k0d002601pmi5hjg0go	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8s71b8000j01pm0ux1p0z5	deleted	{"id": "cmr8s71b8000j01pm0ux1p0z5"}	::ffff:192.168.65.1	2026-07-06 05:32:17.677
cmr8sj5g9002c01pm4f00z7zc	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8sj5g2002b01pmq6m53a2d	Role "E2E Viewer mr8sj47g-457" created	{"name": "E2E Viewer mr8sj47g-457", "slug": "e2e-viewer-mr8sj47g-457", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:172.18.0.5	2026-07-06 05:39:45.369
cmr8sj5nl002f01pm9vcwpq1n	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sj5ni002e01pm53zdbac1	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8sj47g-457@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:39:45.633
cmr8sj5nu002g01pmvpx2pgpk	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8sj5ni002e01pm53zdbac1	updated	{"role_ids": ["cmr8sj5g2002b01pmq6m53a2d"]}	::ffff:192.168.65.1	2026-07-06 05:39:45.642
cmr8sj65r002k01pmy3xk5owy	cmr8sj5ni002e01pm53zdbac1	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:39:46.287
cmr8sj65r002j01pmnvo0jo78	cmr8sj5ni002e01pm53zdbac1	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:39:46.287
cmr8sj65r002l01pmelxnmvvz	cmr8sj5ni002e01pm53zdbac1	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:39:46.288
cmr8sj6dy002n01pmua9lc6i2	cmr8sj5ni002e01pm53zdbac1	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:39:46.582
cmr8sj6e1002o01pmskf98et0	cmr8sj5ni002e01pm53zdbac1	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:39:46.585
cmr8sj6e1002p01pms13sf0e9	cmr8sj5ni002e01pm53zdbac1	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:39:46.585
cmr8sj6e2002q01pmfikqjuk2	cmr8sj5ni002e01pm53zdbac1	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:39:46.586
cmr8sj6f2002s01pmvneblwhc	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8sj6f1002r01pmn1xfscbp	Role "E2E Bypass mr8sj47g-457" created	{"name": "E2E Bypass mr8sj47g-457", "slug": "e2e-bypass-mr8sj47g-457", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:39:46.622
cmr8sj6f9002t01pmd6q9nfbb	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8sj6f1002r01pmn1xfscbp	Role "E2E Bypass mr8sj47g-457" deleted	{"name": "E2E Bypass mr8sj47g-457", "slug": "e2e-bypass-mr8sj47g-457"}	::ffff:192.168.65.1	2026-07-06 05:39:46.629
cmr8sj6m0002v01pmz1roxjqd	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sj6lx002u01pm24oofx94	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8sj47g-457@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:39:46.872
cmr8sj6sp002x01pmfu7bruqh	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8sj6lx002u01pm24oofx94	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:39:47.113
cmr8sj709002z01pme63e367t	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sj706002y01pmr6523osw	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8sj47g-457@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:39:47.385
cmr8sj70h003001pm2dzsrumj	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sj706002y01pmr6523osw	deleted	{"id": "cmr8sj706002y01pmr6523osw"}	::ffff:192.168.65.1	2026-07-06 05:39:47.393
cmr8sj74c003101pm4f6pv0ge	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sj5ni002e01pm53zdbac1	deleted	{"id": "cmr8sj5ni002e01pm53zdbac1"}	::ffff:192.168.65.1	2026-07-06 05:39:47.532
cmr8sj74g003201pmhi0c5zb4	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sj6lx002u01pm24oofx94	deleted	{"id": "cmr8sj6lx002u01pm24oofx94"}	::ffff:192.168.65.1	2026-07-06 05:39:47.536
cmr8sjl9h003901pmp094r24s	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8sjl9f003801pmg82w2tai	Role "E2E Viewer mr8sjkan-7560" created	{"name": "E2E Viewer mr8sjkan-7560", "slug": "e2e-viewer-mr8sjkan-7560", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:172.18.0.5	2026-07-06 05:40:05.861
cmr8sjlgt003b01pmgaga1qt1	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sjlgr003a01pmhnzdf2k7	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8sjkan-7560@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:40:06.125
cmr8sjlh1003c01pmsra54iev	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8sjlgr003a01pmhnzdf2k7	updated	{"role_ids": ["cmr8sjl9f003801pmg82w2tai"]}	::ffff:192.168.65.1	2026-07-06 05:40:06.133
cmr8sjlyl003f01pmw12ynv4z	cmr8sjlgr003a01pmhnzdf2k7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:40:06.765
cmr8sjlym003g01pmlu05tx5e	cmr8sjlgr003a01pmhnzdf2k7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:40:06.766
cmr8sjlyp003h01pmv24nhhun	cmr8sjlgr003a01pmhnzdf2k7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:40:06.769
cmr8sjm6v003j01pmtbqwgzp0	cmr8sjlgr003a01pmhnzdf2k7	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:40:07.063
cmr8sjm6z003l01pmjggffhyu	cmr8sjlgr003a01pmhnzdf2k7	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:40:07.067
cmr8sjm6z003k01pm63uxl1b9	cmr8sjlgr003a01pmhnzdf2k7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:40:07.067
cmr8sjm6z003m01pmyznzho5w	cmr8sjlgr003a01pmhnzdf2k7	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:40:07.067
cmr8sjm7w003o01pm2kj7xuei	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8sjm7v003n01pmckox7zie	Role "E2E Bypass mr8sjkan-7560" created	{"name": "E2E Bypass mr8sjkan-7560", "slug": "e2e-bypass-mr8sjkan-7560", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:40:07.1
cmr8sjm82003p01pmv5z7s4bv	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8sjm7v003n01pmckox7zie	Role "E2E Bypass mr8sjkan-7560" deleted	{"name": "E2E Bypass mr8sjkan-7560", "slug": "e2e-bypass-mr8sjkan-7560"}	::ffff:192.168.65.1	2026-07-06 05:40:07.106
cmr8sjmeg003r01pm9qhxvqta	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sjmee003q01pm8t7u478u	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8sjkan-7560@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:40:07.336
cmr8sjml7003t01pmz3032cx4	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8sjmee003q01pm8t7u478u	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:40:07.579
cmr8sjmtf003v01pmre8oz3zk	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sjmtc003u01pme2ymyqmi	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8sjkan-7560@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:40:07.875
cmr8sjmtm003w01pmq9zeocvm	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sjmtc003u01pme2ymyqmi	deleted	{"id": "cmr8sjmtc003u01pme2ymyqmi"}	::ffff:192.168.65.1	2026-07-06 05:40:07.882
cmr8sjmxj003x01pm37yp31z2	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sjlgr003a01pmhnzdf2k7	deleted	{"id": "cmr8sjlgr003a01pmhnzdf2k7"}	::ffff:192.168.65.1	2026-07-06 05:40:08.023
cmr8sjmxo003y01pmzg80re2w	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sjmee003q01pm8t7u478u	deleted	{"id": "cmr8sjmee003q01pm8t7u478u"}	::ffff:192.168.65.1	2026-07-06 05:40:08.028
cmr8syla8000601mc3ou5s3s3	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8syla3000501mcizobc1pt	Role "E2E Viewer mr8syjy2-9591" created	{"name": "E2E Viewer mr8syjy2-9591", "slug": "e2e-viewer-mr8syjy2-9591", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:172.18.0.5	2026-07-06 05:51:45.728
cmr8sylhe000801mcu5vsfojq	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8sylh9000701mciabvhq7l	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8syjy2-9591@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:51:45.986
cmr8sylhr000901mccidm0vew	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8sylh9000701mciabvhq7l	updated	{"role_ids": ["cmr8syla3000501mcizobc1pt"]}	::ffff:192.168.65.1	2026-07-06 05:51:45.999
cmr8sylzk000c01mcl53cqdy8	cmr8sylh9000701mciabvhq7l	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:51:46.64
cmr8sylzn000d01mc36fkwbah	cmr8sylh9000701mciabvhq7l	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:51:46.643
cmr8sylzp000e01mcabo3hhw7	cmr8sylh9000701mciabvhq7l	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:51:46.645
cmr8sym7z000g01mc01vep6ly	cmr8sylh9000701mciabvhq7l	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:51:46.943
cmr8sym81000h01mcqn3l48xr	cmr8sylh9000701mciabvhq7l	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:51:46.945
cmr8sym82000i01mcburo3cmp	cmr8sylh9000701mciabvhq7l	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:51:46.947
cmr8sym83000j01mc65326yjy	cmr8sylh9000701mciabvhq7l	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:51:46.947
cmr8sym97000l01mc125ndptl	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8sym93000k01mcjy499gjy	Role "E2E Bypass mr8syjy2-9591" created	{"name": "E2E Bypass mr8syjy2-9591", "slug": "e2e-bypass-mr8syjy2-9591", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:51:46.987
cmr8sym9h000m01mclcbinstj	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8sym93000k01mcjy499gjy	Role "E2E Bypass mr8syjy2-9591" deleted	{"name": "E2E Bypass mr8syjy2-9591", "slug": "e2e-bypass-mr8syjy2-9591"}	::ffff:192.168.65.1	2026-07-06 05:51:46.997
cmr8symfy000o01mc2z6aomo1	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8symfv000n01mc2okk2jxo	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8syjy2-9591@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:51:47.23
cmr8symmr000q01mccoiprnt1	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8symfv000n01mc2okk2jxo	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:51:47.475
cmr8symue000s01mcouuybatr	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8symua000r01mckfmhps3h	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8syjy2-9591@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:51:47.75
cmr8symun000t01mcaal547zn	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8symua000r01mckfmhps3h	deleted	{"id": "cmr8symua000r01mckfmhps3h"}	::ffff:192.168.65.1	2026-07-06 05:51:47.759
cmr8symyh000u01mcq8epgaq4	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8sylh9000701mciabvhq7l	deleted	{"id": "cmr8sylh9000701mciabvhq7l"}	::ffff:192.168.65.1	2026-07-06 05:51:47.897
cmr8symym000v01mca4ing8jo	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8symfv000n01mc2okk2jxo	deleted	{"id": "cmr8symfv000n01mc2okk2jxo"}	::ffff:192.168.65.1	2026-07-06 05:51:47.902
cmr8t3v48001301mcputtnflz	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8t3v42001201mc30njqxkr	Role "E2E Viewer mr8t3twk-1516" created	{"name": "E2E Viewer mr8t3twk-1516", "slug": "e2e-viewer-mr8t3twk-1516", "permission_ids": ["cmr8s2w8f000734pmezz1tmq4"]}	::ffff:172.18.0.5	2026-07-06 05:55:51.752
cmr8t3vbl001501mcohvrskoh	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8t3vbi001401mcxwwhatz7	created	{"name": "E2E Viewer", "email": "e2e-viewer-mr8t3twk-1516@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:55:52.017
cmr8t3vbu001601mcmrb8lg0v	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8t3vbi001401mcxwwhatz7	updated	{"role_ids": ["cmr8t3v42001201mc30njqxkr"]}	::ffff:192.168.65.1	2026-07-06 05:55:52.026
cmr8t3vtd001901mc0ohb6gaz	cmr8t3vbi001401mcxwwhatz7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:55:52.657
cmr8t3vtf001a01mcms6g38me	cmr8t3vbi001401mcxwwhatz7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:55:52.659
cmr8t3vtg001b01mcfuuuedey	cmr8t3vbi001401mcxwwhatz7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:172.18.0.5	2026-07-06 05:55:52.66
cmr8t3w23001d01mcpd0x959r	cmr8t3vbi001401mcxwwhatz7	authz:types	permission_denied	\N	\N	Access denied to types:add	{"requested_action": "add", "requested_module": "types"}	::ffff:192.168.65.1	2026-07-06 05:55:52.971
cmr8t3w26001e01mc6tgih7cf	cmr8t3vbi001401mcxwwhatz7	authz:users	permission_denied	\N	\N	Access denied to users:view	{"requested_action": "view", "requested_module": "users"}	::ffff:192.168.65.1	2026-07-06 05:55:52.974
cmr8t3w27001f01mcd1eq63ff	cmr8t3vbi001401mcxwwhatz7	authz:roles	permission_denied	\N	\N	Access denied to roles:view	{"requested_action": "view", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:55:52.975
cmr8t3w39001i01mc23rxjqwf	cmr4hj9r000008wpb6m1i21us	roles	created	RbacRole	cmr8t3w37001h01mcex6umdev	Role "E2E Bypass mr8t3twk-1516" created	{"name": "E2E Bypass mr8t3twk-1516", "slug": "e2e-bypass-mr8t3twk-1516", "permission_ids": []}	::ffff:192.168.65.1	2026-07-06 05:55:53.013
cmr8t3w3f001j01mc7zzsl3pe	cmr4hj9r000008wpb6m1i21us	roles	deleted	RbacRole	cmr8t3w37001h01mcex6umdev	Role "E2E Bypass mr8t3twk-1516" deleted	{"name": "E2E Bypass mr8t3twk-1516", "slug": "e2e-bypass-mr8t3twk-1516"}	::ffff:192.168.65.1	2026-07-06 05:55:53.019
cmr8t3wa5001l01mc2xe0somk	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8t3wa2001k01mc0s4e6iev	created	{"name": "E2E Suspended", "email": "e2e-suspended-mr8t3twk-1516@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:55:53.261
cmr8t3wgr001n01mcv6s5ui31	cmr4hj9r000008wpb6m1i21us	users	updated	User	cmr8t3wa2001k01mc0s4e6iev	updated	{"status": "SUSPENDED"}	::ffff:192.168.65.1	2026-07-06 05:55:53.499
cmr8t3wo6001p01mc013hc8m0	cmr4hj9r000008wpb6m1i21us	users	created	User	cmr8t3wo3001o01mckjfcdxzn	created	{"name": "E2E Deleted", "email": "e2e-deleted-mr8t3twk-1516@e2e.test", "status": "ACTIVE", "password": "[REDACTED]", "role_ids": [], "is_active": true}	::ffff:192.168.65.1	2026-07-06 05:55:53.766
cmr8t3wod001q01mct9pljqmn	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8t3wo3001o01mckjfcdxzn	deleted	{"id": "cmr8t3wo3001o01mckjfcdxzn"}	::ffff:192.168.65.1	2026-07-06 05:55:53.773
cmr8t3ws8001r01mc0thwgo0k	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8t3vbi001401mcxwwhatz7	deleted	{"id": "cmr8t3vbi001401mcxwwhatz7"}	::ffff:192.168.65.1	2026-07-06 05:55:53.912
cmr8t3wsd001s01mc3do9awaf	cmr4hj9r000008wpb6m1i21us	users	deleted	User	cmr8t3wa2001k01mc0s4e6iev	deleted	{"id": "cmr8t3wa2001k01mc0s4e6iev"}	::ffff:192.168.65.1	2026-07-06 05:55:53.917
cmr8t3w27001g01mcfc4ekcvk	cmr8t3vbi001401mcxwwhatz7	authz:roles	permission_denied	\N	\N	Access denied to roles:delete	{"requested_action": "delete", "requested_module": "roles"}	::ffff:192.168.65.1	2026-07-06 05:55:52.975
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.app_settings (id, key, value, type, description, is_public, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, slug, type_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media (id, user_id, filename, original_name, mime_type, size, bucket, path, url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) FROM stdin;
cmr8s3d7k000301pmw9ishcq0	cmr4hj9r000008wpb6m1i21us	1ccdbfd97653095c4146cc2c6de66c0641636dc606297c1e66db46df2187e944	2026-07-06 06:27:28.927	f	2026-07-06 05:27:28.928
cmr8s41iv000901pmiib1f6fk	cmr4hj9r000008wpb6m1i21us	150f734f8db58bb192787fd6ed8c7173f09ea1498a656231e0c426c81d331762	2026-07-06 06:28:00.439	f	2026-07-06 05:28:00.439
cmr8sj5gm002d01pmp9qkv2a6	cmr4hj9r000008wpb6m1i21us	f16dcfb68a9d6b491b827c011c487c1435db0064ce2aa1ba2ecb4dea5cea5ce1	2026-07-06 06:39:45.382	f	2026-07-06 05:39:45.382
cmr8sjkw2003501pm4ok1g54b	cmr4hj9r000008wpb6m1i21us	d953353e9908665cb74da15f1bc484bceb28e12d6caa384d1dc09384794c8d0c	2026-07-06 06:40:05.378	f	2026-07-06 05:40:05.378
cmr8syl8f000401mco4pcxapa	cmr4hj9r000008wpb6m1i21us	672857df684c850d9e04be981f0927eb9a2a7bcc293a76ab77261f3610522bb5	2026-07-06 06:51:45.662	f	2026-07-06 05:51:45.663
cmr8t3v3f001101mck43if682	cmr4hj9r000008wpb6m1i21us	890186366b243d19f043f9f7adc855566a033144205e93cf2ba33462fc857b0e	2026-07-06 06:55:51.723	f	2026-07-06 05:55:51.723
\.


--
-- Data for Name: permission_modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permission_modules (id, name, label, is_system, sort_order, created_at) FROM stdin;
cmr4lnheg00000ta1ivc87ivb	users	Users	t	0	2026-07-03 07:16:05.464
cmr4lnhey00060ta1dhongxzw	roles	Roles	t	1	2026-07-03 07:16:05.482
cmr4lnhfc000c0ta1330gbczv	permissions	Permissions	t	2	2026-07-03 07:16:05.496
cmr4lnhfk000i0ta1cbvom9qq	settings	Settings	t	3	2026-07-03 07:16:05.504
cmr4lnhfq000o0ta1lufhrek1	media	Media	t	4	2026-07-03 07:16:05.51
cmr4lnhfv000u0ta192u0guky	activity-log	Activity Log	t	5	2026-07-03 07:16:05.515
cmr8s2w8e000634pmryrbbqcq	types	Types	t	6	2026-07-06 05:27:06.926
cmr8s2w8k000c34pm17xaxqri	categories	Categories	t	7	2026-07-06 05:27:06.932
cmr8s2w8o000i34pm5gzjnx93	setting-fields	Setting Fields	t	8	2026-07-06 05:27:06.936
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, module_id, action, created_at) FROM stdin;
cmr4lnhem00010ta1ug9ob6kx	cmr4lnheg00000ta1ivc87ivb	view	2026-07-03 07:16:05.47
cmr4lnhep00020ta1q1kgw15n	cmr4lnheg00000ta1ivc87ivb	add	2026-07-03 07:16:05.473
cmr4lnhes00030ta157yte2nk	cmr4lnheg00000ta1ivc87ivb	edit	2026-07-03 07:16:05.476
cmr4lnheu00040ta1551hrnjo	cmr4lnheg00000ta1ivc87ivb	delete	2026-07-03 07:16:05.478
cmr4lnhex00050ta1vpkybwac	cmr4lnheg00000ta1ivc87ivb	publish	2026-07-03 07:16:05.481
cmr4lnhf000070ta1o06qwd8t	cmr4lnhey00060ta1dhongxzw	view	2026-07-03 07:16:05.484
cmr4lnhf300080ta1lkpw0468	cmr4lnhey00060ta1dhongxzw	add	2026-07-03 07:16:05.487
cmr4lnhf500090ta1dzrofn0i	cmr4lnhey00060ta1dhongxzw	edit	2026-07-03 07:16:05.489
cmr4lnhf7000a0ta1l0mycsty	cmr4lnhey00060ta1dhongxzw	delete	2026-07-03 07:16:05.491
cmr4lnhfa000b0ta1qs9yhxc8	cmr4lnhey00060ta1dhongxzw	publish	2026-07-03 07:16:05.494
cmr4lnhfd000d0ta1d847uymt	cmr4lnhfc000c0ta1330gbczv	view	2026-07-03 07:16:05.497
cmr4lnhff000e0ta1i1qo4dwd	cmr4lnhfc000c0ta1330gbczv	add	2026-07-03 07:16:05.499
cmr4lnhfh000f0ta1xztp072d	cmr4lnhfc000c0ta1330gbczv	edit	2026-07-03 07:16:05.501
cmr4lnhfi000g0ta106rc3az0	cmr4lnhfc000c0ta1330gbczv	delete	2026-07-03 07:16:05.502
cmr4lnhfj000h0ta1nljvvjnf	cmr4lnhfc000c0ta1330gbczv	publish	2026-07-03 07:16:05.503
cmr4lnhfl000j0ta1uor20z3c	cmr4lnhfk000i0ta1cbvom9qq	view	2026-07-03 07:16:05.505
cmr4lnhfm000k0ta1wo31621k	cmr4lnhfk000i0ta1cbvom9qq	add	2026-07-03 07:16:05.506
cmr4lnhfn000l0ta1a1w8s989	cmr4lnhfk000i0ta1cbvom9qq	edit	2026-07-03 07:16:05.507
cmr4lnhfo000m0ta1sh2r45ls	cmr4lnhfk000i0ta1cbvom9qq	delete	2026-07-03 07:16:05.508
cmr4lnhfp000n0ta1xvile1oo	cmr4lnhfk000i0ta1cbvom9qq	publish	2026-07-03 07:16:05.509
cmr4lnhfr000p0ta19gwi5ck3	cmr4lnhfq000o0ta1lufhrek1	view	2026-07-03 07:16:05.511
cmr4lnhfs000q0ta1qkloitns	cmr4lnhfq000o0ta1lufhrek1	add	2026-07-03 07:16:05.512
cmr4lnhft000r0ta1hsfdvait	cmr4lnhfq000o0ta1lufhrek1	edit	2026-07-03 07:16:05.513
cmr4lnhfu000s0ta107e0js90	cmr4lnhfq000o0ta1lufhrek1	delete	2026-07-03 07:16:05.514
cmr4lnhfv000t0ta14ms3gb5u	cmr4lnhfq000o0ta1lufhrek1	publish	2026-07-03 07:16:05.515
cmr4lnhfw000v0ta1qbqs12dn	cmr4lnhfv000u0ta192u0guky	view	2026-07-03 07:16:05.516
cmr4lnhfx000w0ta1wiekgdrd	cmr4lnhfv000u0ta192u0guky	add	2026-07-03 07:16:05.517
cmr4lnhfy000x0ta1vyujj3hi	cmr4lnhfv000u0ta192u0guky	edit	2026-07-03 07:16:05.518
cmr4lnhfz000y0ta1r7zcz2ag	cmr4lnhfv000u0ta192u0guky	delete	2026-07-03 07:16:05.519
cmr4lnhg0000z0ta1jhg0lc2j	cmr4lnhfv000u0ta192u0guky	publish	2026-07-03 07:16:05.52
cmr8s2w8f000734pmezz1tmq4	cmr8s2w8e000634pmryrbbqcq	view	2026-07-06 05:27:06.927
cmr8s2w8g000834pm0p319vz2	cmr8s2w8e000634pmryrbbqcq	add	2026-07-06 05:27:06.928
cmr8s2w8h000934pmuu5df55e	cmr8s2w8e000634pmryrbbqcq	edit	2026-07-06 05:27:06.929
cmr8s2w8i000a34pm4thqzjtj	cmr8s2w8e000634pmryrbbqcq	delete	2026-07-06 05:27:06.93
cmr8s2w8j000b34pm88sjeva4	cmr8s2w8e000634pmryrbbqcq	publish	2026-07-06 05:27:06.931
cmr8s2w8k000d34pmyalsbtp6	cmr8s2w8k000c34pm17xaxqri	view	2026-07-06 05:27:06.932
cmr8s2w8l000e34pmbcduqtci	cmr8s2w8k000c34pm17xaxqri	add	2026-07-06 05:27:06.933
cmr8s2w8m000f34pm2vo1i3vo	cmr8s2w8k000c34pm17xaxqri	edit	2026-07-06 05:27:06.934
cmr8s2w8n000g34pmf9yfo0s9	cmr8s2w8k000c34pm17xaxqri	delete	2026-07-06 05:27:06.935
cmr8s2w8n000h34pm6kaz2nui	cmr8s2w8k000c34pm17xaxqri	publish	2026-07-06 05:27:06.935
cmr8s2w8p000j34pmrsc1hrs2	cmr8s2w8o000i34pm5gzjnx93	view	2026-07-06 05:27:06.937
cmr8s2w8q000k34pmpoh0csjv	cmr8s2w8o000i34pm5gzjnx93	add	2026-07-06 05:27:06.938
cmr8s2w8r000l34pmi07kiogg	cmr8s2w8o000i34pm5gzjnx93	edit	2026-07-06 05:27:06.939
cmr8s2w8s000m34pmdpc4i5s7	cmr8s2w8o000i34pm5gzjnx93	delete	2026-07-06 05:27:06.94
cmr8s2w8t000n34pm6pxowxim	cmr8s2w8o000i34pm5gzjnx93	publish	2026-07-06 05:27:06.941
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at) FROM stdin;
cmr4hjlyk000001pbkd4ap5n3	cmr4hj9r000008wpb6m1i21us	d12c5c9f158715db5f46bea6dc8ceb961ae58eaceceb4cffc272850c40214bee	2026-07-10 05:21:06.277	t	2026-07-03 05:21:06.284
cmr4ittpw000101pb2uscntfd	cmr4hj9r000008wpb6m1i21us	018d5cd555f9f974c4fb0ce396e2b3ba8afec2aa99fa9129acc33752afde76e1	2026-07-10 05:57:02.516	t	2026-07-03 05:57:02.516
cmr4j3rnb000201pb9wy64088	cmr4hj9r000008wpb6m1i21us	bbb4ce4201b32d552a24bd8ac6e42f0be696e41668c41f4eaf2cb33c0265f14a	2026-07-10 06:04:46.39	t	2026-07-03 06:04:46.391
cmr4jko1k000301pbr8v046cy	cmr4hj9r000008wpb6m1i21us	123b1014063850e64998358845024fad362754ac3a337cc874d638449628ec55	2026-07-10 06:17:54.871	t	2026-07-03 06:17:54.872
cmr4ke1t5000401pbdjox924v	cmr4hj9r000008wpb6m1i21us	fe771cc3dc06b318e9cf0b98691a23dfc7b9d487a1bf8d29a24795c3064b73ad	2026-07-10 06:40:45.736	t	2026-07-03 06:40:45.737
cmr4lw9rr000501pb518hpupc	cmr4hj9r000008wpb6m1i21us	beb7388d46a19136f2ecc1cc09c1286fc7d94feda5586abb5c2aecc5b1ddf8c9	2026-07-10 07:22:55.479	f	2026-07-03 07:22:55.479
cmr4m3hpz000601pbvotcipxc	cmr4hj9r000008wpb6m1i21us	d6f5d2fa31bcb3a2b464a47b5dce6203f9b015ceba7734d7feff84749ba12381	2026-07-10 07:28:32.375	t	2026-07-03 07:28:32.376
cmr4qeze7000701pbi12t3t06	cmr4hj9r000008wpb6m1i21us	9c9b8058a6133f94fff7b39a9fea93ce5f4a525fd2d0be4f0f79dfe2bfb7dbf0	2026-07-10 09:29:26.959	t	2026-07-03 09:29:26.959
cmr4rguus000801pbhpwca5zr	cmr4hj9r000008wpb6m1i21us	cef496e5341047005a631223e39fa0990c7c676709486b97ee24ee71942789f5	2026-07-10 09:58:54.004	f	2026-07-03 09:58:54.004
cmr4tqp56000901pbzyzjalf5	cmr4hj9r000008wpb6m1i21us	2fb455d646bc354bd5774a68c29f501f3c30f58da5a4b2a0c6f6cd06b690a515	2026-07-10 11:02:32.394	f	2026-07-03 11:02:32.394
cmr4tquhc000a01pby0uluqcp	cmr4hj9r000008wpb6m1i21us	0a7f380bd02e0611449a826150a8f3c1f5ba09820b480f2691a7fddea13d63ce	2026-07-10 11:02:39.312	f	2026-07-03 11:02:39.312
cmr4x7iyz000001pd5sce3vrk	cmr4hj9r000008wpb6m1i21us	e9ee23a2564eb2728ca4ca40c5ad7534430eecd39acffbe5e53daeacf90eb4d9	2026-07-10 12:39:36.388	t	2026-07-03 12:39:36.395
cmr4x7jaa000101pd8z36g1eu	cmr4hj9r000008wpb6m1i21us	b27978f3e6f0e696bd969a35d21ecdb1bac73602becf0c93024825f2949fecb1	2026-07-10 12:39:36.802	f	2026-07-03 12:39:36.802
cmr8ogvit000001pd4o74aj21	cmr4hj9r000008wpb6m1i21us	1e64c5bd8537e0c0da6049fb876e446088b5c35d219ab0843da3ef3a329012cf	2026-07-13 03:46:00.718	t	2026-07-06 03:46:00.725
cmr8oif28000101pdbr6gn1la	cmr4hj9r000008wpb6m1i21us	42add4f047aa8c8e6f92836c6e463d02ea7ff9b7da7a25fe31ded4cc024878ed	2026-07-13 03:47:12.703	t	2026-07-06 03:47:12.704
cmr8pamm7000201pdjxetghg6	cmr4hj9r000008wpb6m1i21us	f66852cabc36d097cb9aa5dcd8fdb446a733dbb04dbea3d687905760d526b2e4	2026-07-13 04:09:08.862	t	2026-07-06 04:09:08.863
cmr8pcdzz000301pdtxabcqms	cmr4hj9r000008wpb6m1i21us	35cf7e0a072cba01b82f436535e4675841203f7d0a3dbd58c360dfa347c8c00c	2026-07-13 04:10:31.007	t	2026-07-06 04:10:31.007
cmr8pyzz1000401pdonitf6qe	cmr4hj9r000008wpb6m1i21us	36d76fb61549367b831a42646baa00cd247a4ef8a8749afe11418d78f868d4b5	2026-07-13 04:28:05.917	t	2026-07-06 04:28:05.917
cmr8qc5pc000501pdvkeos277	cmr4hj9r000008wpb6m1i21us	ae1185f71494b47ed7fd964c191083031618012b9bd5788f4290683f98753734	2026-07-13 04:38:19.871	t	2026-07-06 04:38:19.872
cmr8qch0b000601pd7vnz3cml	cmr4hj9r000008wpb6m1i21us	b7e82676699f2ad86c6c7396dbe263938a3b7220b0904197614d36fe7232e082	2026-07-13 04:38:34.523	t	2026-07-06 04:38:34.523
cmr8qlhmb000701pdg9mecshx	cmr4hj9r000008wpb6m1i21us	116d0fe09a74a3c3f5a5079d690b259ca695d70bcc7bf7560ea3ae8f57ef225b	2026-07-13 04:45:35.219	t	2026-07-06 04:45:35.219
cmr8r5so0000801pdmk0v5ml9	cmr4hj9r000008wpb6m1i21us	8389d1a95cf7b9e16fffe1669279b55b1fda734ff4b2530b60a4933bf4ef1913	2026-07-13 05:01:22.655	t	2026-07-06 05:01:22.656
cmr8ruocm000a01pdi5a19fe8	cmr4hj9r000008wpb6m1i21us	effb22882639abfa7e4be18a85d895082c4644404e60e2e39500522554c2e417	2026-07-13 05:20:43.462	f	2026-07-06 05:20:43.462
cmr8rqvlk000901pdppkhwnkw	cmr4hj9r000008wpb6m1i21us	91927b4f2b467f5117f576741a7769a0072d8950473d8b73fc683e2ed0e5a5ab	2026-07-13 05:17:46.23	t	2026-07-06 05:17:46.232
cmr8rzn8b000c01pdiapkefaa	cmr4hj9r000008wpb6m1i21us	61fc95ede4283998f07cb3f9b52d94b012e43a6baa69c1e8c9bd20b289cd04d7	2026-07-13 05:24:35.29	f	2026-07-06 05:24:35.291
cmr8s0bhz000d01pd358bp27k	cmr4hj9r000008wpb6m1i21us	df8571eabb5d5432ce72ac3b510d45eae6e296fc66138b95d5d450557e9495e5	2026-07-13 05:25:06.743	f	2026-07-06 05:25:06.743
cmr8ruwkt000b01pdqa0564nc	cmr4hj9r000008wpb6m1i21us	0962508294283c721f1a3432d037aeb5ad9e928839761bae56e1103f9416f4b9	2026-07-13 05:20:54.125	t	2026-07-06 05:20:54.125
cmr8s34b8000001pmu2wm3e17	cmr4hj9r000008wpb6m1i21us	faf62e405ffac1a8f24f3b772467451e03f3a8f5b8cc799ec607d354c3af4eb0	2026-07-13 05:27:17.39	f	2026-07-06 05:27:17.396
cmr8s3auj000101pm0enosm6e	cmr4hj9r000008wpb6m1i21us	325d53fdf3aab93063496a88818b1b3d2652583309801ab1db8a58ea074a6189	2026-07-13 05:27:25.866	f	2026-07-06 05:27:25.867
cmr8s3d1c000201pm5dk0q9lm	cmr4hj9r000008wpb6m1i21us	673ee0ac170b756add775c1d3facf2f6d744693ec4a4a1f6e89f8bbfefa48488	2026-07-13 05:27:28.704	f	2026-07-06 05:27:28.704
cmr8s3izi000401pmrcuma8tu	cmr4hj9r000008wpb6m1i21us	e132b5ae7564bc52e954580f9d333cdda8efdaf133d04d990418305ba0627b79	2026-07-13 05:27:36.414	f	2026-07-06 05:27:36.414
cmr8s40le000501pmd8sytsqv	cmr4hj9r000008wpb6m1i21us	ef4f4cbecb2ec7ff3dfed62dbd7736a612b3ac709dcb3eb0e51a1ed6092518d7	2026-07-13 05:27:59.233	f	2026-07-06 05:27:59.234
cmr8s4155000701pm6hlfatpk	cmr4hj9r000008wpb6m1i21us	41ca018475b58e9d9cdf3d1630ec81bd271f54548425e13848fa48876724e2d6	2026-07-13 05:27:59.944	f	2026-07-06 05:27:59.945
cmr8s40yy000601pmclq0dssf	cmr4hj9r000008wpb6m1i21us	ef0ac5fc59c413f4dffd3e4ec0fed61a397fd6f134cdd9db6453ca59d373604e	2026-07-13 05:27:59.722	t	2026-07-06 05:27:59.722
cmr8s41g9000801pmaxjs5fpm	cmr4hj9r000008wpb6m1i21us	164e12d6ed59d4f63cb74695ff03f94bd80c5d2014c132c1586b40759d19d7ee	2026-07-13 05:28:00.345	f	2026-07-06 05:28:00.345
cmr8s2k2k000e01pddwqmpskd	cmr4hj9r000008wpb6m1i21us	743aba0d1d0e14c40f1527a8f75c3a6aa174da189471a8c2c852a72a1a851de7	2026-07-13 05:26:51.164	t	2026-07-06 05:26:51.164
cmr8s6ofe000b01pmk72fupxy	cmr4hj9r000008wpb6m1i21us	10b01c433323e42864306ae554ae6337c7edc6510950dde813687633a4386f70	2026-07-13 05:30:03.434	f	2026-07-06 05:30:03.434
cmr8s714a000i01pmwxr6rx1b	cmr4hj9r000008wpb6m1i21us	f363caf69e7d0d45e9a796e6acaebb5bc1ad75621a5f714fba23570d310cfcd4	2026-07-13 05:30:19.881	f	2026-07-06 05:30:19.882
cmr8s7ute000l01pmk9ufwaem	cmr4hj9r000008wpb6m1i21us	95476640c2977130a6bc5d4b8c14129626bd79765bf83115ee3a55f382b1dd0d	2026-07-13 05:30:58.37	f	2026-07-06 05:30:58.37
cmr8s7v7q000r01pm4tf2p48a	cmr8s7v0z000o01pmo4kqhzs7	a610d618086a52d42d54ece58ca96e2722dbeca9b810471a0392767207e5557d	2026-07-13 05:30:58.886	f	2026-07-06 05:30:58.886
cmr8s7vts000s01pmaynpqv6q	cmr8s7v0z000o01pmo4kqhzs7	73bda358a5c9a2605e10d9d174a775c52c17741bd0c5dcac16affab1d1374958	2026-07-13 05:30:59.68	f	2026-07-06 05:30:59.68
cmr8s7w2s000w01pmodewpkwy	cmr8s7v0z000o01pmo4kqhzs7	e7a833ef0cd0726619252001d2b3fc13e131c796782d3dd5e914d5166f35c885	2026-07-13 05:31:00.004	f	2026-07-06 05:31:00.004
cmr8s7wh2001601pmzakvrk1s	cmr8s7wat001401pmj3dxy1t9	57b43bdf86f93ab3b9eb2cf5b1d29dfd0c01fbc6dc13295489c272cc9272a267	2026-07-13 05:31:00.518	f	2026-07-06 05:31:00.518
cmr8s4izi000a01pm2q1m5r1o	cmr4hj9r000008wpb6m1i21us	25e56bd3a0d42fab128143e08abfc3264a1a714da0dcb1fb71b77caa2938bb73	2026-07-13 05:28:23.07	t	2026-07-06 05:28:23.07
cmr8s95t7001d01pmhu3t4zyp	cmr4hj9r000008wpb6m1i21us	41fc7e9bcc320398f902f30217431fe89aee73a0c64a3796fa295d78a9464c15	2026-07-13 05:31:59.275	f	2026-07-06 05:31:59.275
cmr8s967e001j01pmulibuks0	cmr8s960r001g01pm8ewzxz6n	601c5e32e53bfbf0960fbdea96aa0726d66fc16b8015f5c0aea24f4a09e091c1	2026-07-13 05:31:59.786	f	2026-07-06 05:31:59.786
cmr8s96kd001k01pm26dz8pbc	cmr8s960r001g01pm8ewzxz6n	41ebca150a0768da4cb4a62495e12d42a7177636c99bc33f6ccbb58acf1445d2	2026-07-13 05:32:00.252	f	2026-07-06 05:32:00.253
cmr8s96u0001o01pma4bdp7hw	cmr8s960r001g01pm8ewzxz6n	9d56ba5c1d0cc4911eca61aa299071d6df83e46715728cf961e29988fd07de0a	2026-07-13 05:32:00.6	f	2026-07-06 05:32:00.6
cmr8s9785001y01pmw6zytb7k	cmr8s971v001w01pmecjlzkcu	86df012d625181687ad469809ba2390fe1365e583cdbf9bb8e8e879b12fff5f8	2026-07-13 05:32:01.109	f	2026-07-06 05:32:01.109
cmr8s9jyw002501pm7vutxuor	cmr4hj9r000008wpb6m1i21us	468970aaa8a74cf856cb16c9793b4dbfe19ef84c2f9235e4e4d8a5f6c18baa99	2026-07-13 05:32:17.624	f	2026-07-06 05:32:17.624
cmr8sj4fk002701pmfuxnrnwp	cmr4hj9r000008wpb6m1i21us	559d4b65a53e662380a28842ef5e179c0839cfe365d4ca1a4cdd52b23c45f9bd	2026-07-13 05:39:44.048	f	2026-07-06 05:39:44.048
cmr8sj512002901pmsf0p0x1i	cmr4hj9r000008wpb6m1i21us	616710fccaca6799ae34718c3a5fc9a7f31b12aafe0fc3591e448cc9dd29aa2e	2026-07-13 05:39:44.822	f	2026-07-06 05:39:44.822
cmr8sj4us002801pmkuqasazc	cmr4hj9r000008wpb6m1i21us	b0099d96b3c60ec0ba8235bb9fd085ab2669206649793789bf31e22e08db35c2	2026-07-13 05:39:44.596	t	2026-07-06 05:39:44.596
cmr8sj5be002a01pm0ah2vg52	cmr4hj9r000008wpb6m1i21us	ab9bb03ec66319f98fb17b8da96ef947cf638a23bfdd1fd4394fb8517742c400	2026-07-13 05:39:45.194	f	2026-07-06 05:39:45.194
cmr8sj5u4002h01pmlhx6bsw2	cmr8sj5ni002e01pm53zdbac1	4d4b2a1cf9f504bb27cf36cb9fee6b46dc0bd62ea6291c15e68d3f2be11b51c9	2026-07-13 05:39:45.868	f	2026-07-06 05:39:45.868
cmr8sj64k002i01pmjm5wyrbt	cmr8sj5ni002e01pm53zdbac1	aa28685d7bcd07e603c8f0bb8a4e07344b7642a15a60c5db4c509a2dd1849195	2026-07-13 05:39:46.244	f	2026-07-06 05:39:46.244
cmr8sj6dk002m01pmsaz5xgsg	cmr8sj5ni002e01pm53zdbac1	cb7ea59d2f763e0856473dab45370c208d2a3fa7f943af9817a0d3c0a07d2337	2026-07-13 05:39:46.568	f	2026-07-06 05:39:46.568
cmr8sj6s9002w01pm5ingq4g0	cmr8sj6lx002u01pm24oofx94	9dcd4a6cdb721e8446c4ec58a23b407b58c049b044e17cee6d6debf606f07b72	2026-07-13 05:39:47.097	f	2026-07-06 05:39:47.097
cmr8sjkj6003301pmesp85ete	cmr4hj9r000008wpb6m1i21us	060ae10fa19ac2687cee02dfcdad9925cea4f04c607fead7d1e1dc20f29c164c	2026-07-13 05:40:04.914	f	2026-07-06 05:40:04.914
cmr8sjkpm003401pm6lliy2tt	cmr4hj9r000008wpb6m1i21us	62548c9c68404a7a3fb7facb9aa2e5deeb479c441a94d23f57765c2b4821e4b6	2026-07-13 05:40:05.146	f	2026-07-06 05:40:05.146
cmr8sjl3p003601pmmkws3f6c	cmr4hj9r000008wpb6m1i21us	778c6b41766f89dfbd3456ec6d1813247c350e79c67662762797bece802e1850	2026-07-13 05:40:05.653	t	2026-07-06 05:40:05.653
cmr8sjl67003701pm6j7un4ma	cmr4hj9r000008wpb6m1i21us	a38b00e21966f9a7608a43410c3bc6ff72c085637280f66d85c596aaafb7c734	2026-07-13 05:40:05.743	f	2026-07-06 05:40:05.743
cmr8sjln9003d01pm2qsuu6oz	cmr8sjlgr003a01pmhnzdf2k7	00006448a30c984dae355b535c76261a1bd742d8a4bcdfd6b236924fbe2c3ee5	2026-07-13 05:40:06.357	f	2026-07-06 05:40:06.357
cmr8sjlxm003e01pm9t6klo2t	cmr8sjlgr003a01pmhnzdf2k7	46754b3960f5284fd80c6911d5e5ecd8afc279dbb3b25e9feae87c146c636a6a	2026-07-13 05:40:06.73	f	2026-07-06 05:40:06.73
cmr8sjm6h003i01pmyr3x8zk3	cmr8sjlgr003a01pmhnzdf2k7	2f0775fe03592fdfdbd2982af340ff4bb69339d424c8b6403647d88e8656ebb9	2026-07-13 05:40:07.049	f	2026-07-06 05:40:07.049
cmr8sjmkr003s01pmo0qg0oek	cmr8sjmee003q01pm8t7u478u	549fdebb12a68afc7db3070f3b3486b86741b76eff01dde10ae82e1422e2ed6b	2026-07-13 05:40:07.563	f	2026-07-06 05:40:07.563
cmr8sykap000001mcu1x00wxu	cmr4hj9r000008wpb6m1i21us	0d7fba6d0382ff173334bcfa1998ce5c287396dc12a384479d6835aaf26c189a	2026-07-13 05:51:44.442	f	2026-07-06 05:51:44.449
cmr8sykof000101mcig8c78ny	cmr4hj9r000008wpb6m1i21us	51f0cb1d36e2ca40f0c56bb7f56d74f2caeb87faa5252efa19c90a7a84eacab6	2026-07-13 05:51:44.943	f	2026-07-06 05:51:44.943
cmr8sykum000201mcb6ovdlde	cmr4hj9r000008wpb6m1i21us	022ff8ae4cbf01d3de552b038d18db618d367ba277aeaf5d2382bebf109eb61b	2026-07-13 05:51:45.165	t	2026-07-06 05:51:45.166
cmr8syl67000301mcdfw27j83	cmr4hj9r000008wpb6m1i21us	aedd6e5587f0b51c30034d79e002cc12ec69cfefa2978892778b979f219870fc	2026-07-13 05:51:45.583	f	2026-07-06 05:51:45.583
cmr8sylo1000a01mcwao7euc3	cmr8sylh9000701mciabvhq7l	2d8093306cd6a156d5f03ddc13b3ca36c624841ff59d55ed71900e4058ad4446	2026-07-13 05:51:46.225	f	2026-07-06 05:51:46.225
cmr8sylyf000b01mcw74wmm4z	cmr8sylh9000701mciabvhq7l	ce9d0010f0cbb48c90ca7e5a7beb9afdc1db485ece68733f5eb574800d109420	2026-07-13 05:51:46.599	f	2026-07-06 05:51:46.599
cmr8sym7k000f01mc3mtmt6v8	cmr8sylh9000701mciabvhq7l	d2bef7d34b8496b5f7168a8f99d43c80020bc3eca3c0c98912505373ee52eef9	2026-07-13 05:51:46.928	f	2026-07-06 05:51:46.928
cmr8symm6000p01mc5w18mmun	cmr8symfv000n01mc2okk2jxo	2038bbc64cb6eb61aa51bcd30e810d7075d7f6a50afbdb17843e9ae973d237b5	2026-07-13 05:51:47.454	f	2026-07-06 05:51:47.454
cmr8t2tb0000w01mcgthfp351	cmr4hj9r000008wpb6m1i21us	9cd30484bd4ffac84b02ccbc0735140e9de2ccceeec9d37e3a02789bc16119cf	2026-07-13 05:55:02.748	f	2026-07-06 05:55:02.748
cmr8t3u4b000x01mcvvwfa6mn	cmr4hj9r000008wpb6m1i21us	59573a26e91d8654dc9cd22b9e49182046475936adffd8a21710c459a40b78a6	2026-07-13 05:55:50.458	f	2026-07-06 05:55:50.459
cmr8t3uoq000z01mcizrdtxwi	cmr4hj9r000008wpb6m1i21us	aae25d5039eb6248f753b5d67fedff4e1e7395093f5875f9dc01add8ce061b99	2026-07-13 05:55:51.194	f	2026-07-06 05:55:51.194
cmr8t3uij000y01mc74ya9flf	cmr4hj9r000008wpb6m1i21us	ef838f662b48f810382463348cb83cc6fbe54145b77a53dd4a105676599bae88	2026-07-13 05:55:50.971	t	2026-07-06 05:55:50.971
cmr8t3uzp001001mcwtzh0c7f	cmr4hj9r000008wpb6m1i21us	19dce925cfbef421aea398219afb80ac002a283968a35fa70dccf511dad93c63	2026-07-13 05:55:51.589	f	2026-07-06 05:55:51.589
cmr8t3vi3001701mcuma56oxp	cmr8t3vbi001401mcxwwhatz7	10c9e9cc4e158dd8c6f775062865368019d3d5ed7aab44e90dbf81826369227d	2026-07-13 05:55:52.251	f	2026-07-06 05:55:52.251
cmr8t3vsc001801mcg558he8w	cmr8t3vbi001401mcxwwhatz7	9556cb9ae5e368d28b66f185566c0ef3e7a42aef16e6280d832ebefe0b89ef77	2026-07-13 05:55:52.619	f	2026-07-06 05:55:52.62
cmr8t3w1s001c01mcygm7a5q0	cmr8t3vbi001401mcxwwhatz7	729caff14a2d529ba8cd0e8635dac4c9a0987039a7734da6d4fec74639a676a4	2026-07-13 05:55:52.96	f	2026-07-06 05:55:52.96
cmr8t3wge001m01mc3xgwime1	cmr8t3wa2001k01mc0s4e6iev	29b4b5726894df702e13ea8023768f0b5db32052c34b7fe218cc7337c90ea6f5	2026-07-13 05:55:53.486	f	2026-07-06 05:55:53.486
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (role_id, permission_id) FROM stdin;
cmr4lnhg200110ta12v5i48pw	cmr4lnhem00010ta1ug9ob6kx
cmr4lnhg200110ta12v5i48pw	cmr4lnhep00020ta1q1kgw15n
cmr4lnhg200110ta12v5i48pw	cmr4lnhes00030ta157yte2nk
cmr4lnhg200110ta12v5i48pw	cmr4lnheu00040ta1551hrnjo
cmr4lnhg200110ta12v5i48pw	cmr4lnhex00050ta1vpkybwac
cmr4lnhg200110ta12v5i48pw	cmr4lnhf000070ta1o06qwd8t
cmr4lnhg200110ta12v5i48pw	cmr4lnhf300080ta1lkpw0468
cmr4lnhg200110ta12v5i48pw	cmr4lnhf500090ta1dzrofn0i
cmr4lnhg200110ta12v5i48pw	cmr4lnhfa000b0ta1qs9yhxc8
cmr4lnhg200110ta12v5i48pw	cmr4lnhfl000j0ta1uor20z3c
cmr4lnhg200110ta12v5i48pw	cmr4lnhfm000k0ta1wo31621k
cmr4lnhg200110ta12v5i48pw	cmr4lnhfn000l0ta1a1w8s989
cmr4lnhg200110ta12v5i48pw	cmr4lnhfo000m0ta1sh2r45ls
cmr4lnhg200110ta12v5i48pw	cmr4lnhfp000n0ta1xvile1oo
cmr4lnhg200110ta12v5i48pw	cmr4lnhfr000p0ta19gwi5ck3
cmr4lnhg200110ta12v5i48pw	cmr4lnhfs000q0ta1qkloitns
cmr4lnhg200110ta12v5i48pw	cmr4lnhft000r0ta1hsfdvait
cmr4lnhg200110ta12v5i48pw	cmr4lnhfu000s0ta107e0js90
cmr4lnhg200110ta12v5i48pw	cmr4lnhfv000t0ta14ms3gb5u
cmr4lnhg200110ta12v5i48pw	cmr4lnhfw000v0ta1qbqs12dn
cmr4lnhg200110ta12v5i48pw	cmr4lnhfx000w0ta1wiekgdrd
cmr4lnhg200110ta12v5i48pw	cmr4lnhfy000x0ta1vyujj3hi
cmr4lnhg200110ta12v5i48pw	cmr4lnhfz000y0ta1r7zcz2ag
cmr4lnhg200110ta12v5i48pw	cmr4lnhg0000z0ta1jhg0lc2j
cmr4lnhg200110ta12v5i48pw	cmr8s2w8f000734pmezz1tmq4
cmr4lnhg200110ta12v5i48pw	cmr8s2w8g000834pm0p319vz2
cmr4lnhg200110ta12v5i48pw	cmr8s2w8h000934pmuu5df55e
cmr4lnhg200110ta12v5i48pw	cmr8s2w8i000a34pm4thqzjtj
cmr4lnhg200110ta12v5i48pw	cmr8s2w8j000b34pm88sjeva4
cmr4lnhg200110ta12v5i48pw	cmr8s2w8k000d34pmyalsbtp6
cmr4lnhg200110ta12v5i48pw	cmr8s2w8l000e34pmbcduqtci
cmr4lnhg200110ta12v5i48pw	cmr8s2w8m000f34pm2vo1i3vo
cmr4lnhg200110ta12v5i48pw	cmr8s2w8n000g34pmf9yfo0s9
cmr4lnhg200110ta12v5i48pw	cmr8s2w8n000h34pm6kaz2nui
cmr4lnhg200110ta12v5i48pw	cmr8s2w8p000j34pmrsc1hrs2
cmr4lnhg200110ta12v5i48pw	cmr8s2w8q000k34pmpoh0csjv
cmr4lnhg200110ta12v5i48pw	cmr8s2w8r000l34pmi07kiogg
cmr4lnhg200110ta12v5i48pw	cmr8s2w8s000m34pmdpc4i5s7
cmr4lnhg200110ta12v5i48pw	cmr8s2w8t000n34pm6pxowxim
cmr8s7uug000m01pmklgzz5rs	cmr8s2w8f000734pmezz1tmq4
cmr8s95ub001e01pm2hlowge3	cmr8s2w8f000734pmezz1tmq4
cmr8sj5g2002b01pmq6m53a2d	cmr8s2w8f000734pmezz1tmq4
cmr8sjl9f003801pmg82w2tai	cmr8s2w8f000734pmezz1tmq4
cmr8syla3000501mcizobc1pt	cmr8s2w8f000734pmezz1tmq4
cmr8t3v42001201mc30njqxkr	cmr8s2w8f000734pmezz1tmq4
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, slug, description, is_system, created_at, updated_at) FROM stdin;
cmr8s7uug000m01pmklgzz5rs	E2E Viewer mr8s7ult-3556	e2e-viewer-mr8s7ult-3556	\N	f	2026-07-06 05:30:58.408	2026-07-06 05:30:58.408
cmr8s95ub001e01pm2hlowge3	E2E Viewer mr8s95lm-2541	e2e-viewer-mr8s95lm-2541	\N	f	2026-07-06 05:31:59.315	2026-07-06 05:31:59.315
cmr8sj5g2002b01pmq6m53a2d	E2E Viewer mr8sj47g-457	e2e-viewer-mr8sj47g-457		f	2026-07-06 05:39:45.362	2026-07-06 05:39:45.362
cmr8sjl9f003801pmg82w2tai	E2E Viewer mr8sjkan-7560	e2e-viewer-mr8sjkan-7560		f	2026-07-06 05:40:05.859	2026-07-06 05:40:05.859
cmr4lnhg100100ta1ipbvu9c8	Super Admin	super-admin	Full access — bypasses all permission checks in middleware	t	2026-07-03 07:16:05.521	2026-07-06 05:41:55.813
cmr4lnhg200110ta12v5i48pw	Admin	admin	All module actions except role deletion and permission management	t	2026-07-03 07:16:05.522	2026-07-06 05:41:55.814
cmr4lnhg200120ta1syh22j84	User	user	Standard user — app-level features only	t	2026-07-03 07:16:05.522	2026-07-06 05:41:55.815
cmr8syla3000501mcizobc1pt	E2E Viewer mr8syjy2-9591	e2e-viewer-mr8syjy2-9591		f	2026-07-06 05:51:45.723	2026-07-06 05:51:45.723
cmr8t3v42001201mc30njqxkr	E2E Viewer mr8t3twk-1516	e2e-viewer-mr8t3twk-1516		f	2026-07-06 05:55:51.746	2026-07-06 05:55:51.746
\.


--
-- Data for Name: setting_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.setting_fields (id, field_name, slug, input_type, value, alt_text, options, type_id, category_id, sort, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.types (id, name, slug, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (user_id, permission_id, mode) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (user_id, role_id) FROM stdin;
cmr4hj9r000008wpb6m1i21us	cmr4lnhg100100ta1ipbvu9c8
cmr8s6onl000e01pm3f6bhtzb	cmr4lnhg200120ta1syh22j84
cmr8s71b8000j01pm0ux1p0z5	cmr4lnhg200120ta1syh22j84
cmr8s7v0z000o01pmo4kqhzs7	cmr8s7uug000m01pmklgzz5rs
cmr8s7wat001401pmj3dxy1t9	cmr4lnhg200120ta1syh22j84
cmr8s7wox001801pmbc27i3mo	cmr4lnhg200120ta1syh22j84
cmr8s960r001g01pm8ewzxz6n	cmr8s95ub001e01pm2hlowge3
cmr8s971v001w01pmecjlzkcu	cmr4lnhg200120ta1syh22j84
cmr8s97fy002001pm4nsp4vx9	cmr4lnhg200120ta1syh22j84
cmr8sj5ni002e01pm53zdbac1	cmr8sj5g2002b01pmq6m53a2d
cmr8sj6lx002u01pm24oofx94	cmr4lnhg200120ta1syh22j84
cmr8sj706002y01pmr6523osw	cmr4lnhg200120ta1syh22j84
cmr8sjlgr003a01pmhnzdf2k7	cmr8sjl9f003801pmg82w2tai
cmr8sjmee003q01pm8t7u478u	cmr4lnhg200120ta1syh22j84
cmr8sjmtc003u01pme2ymyqmi	cmr4lnhg200120ta1syh22j84
cmr8sylh9000701mciabvhq7l	cmr8syla3000501mcizobc1pt
cmr8symfv000n01mc2okk2jxo	cmr4lnhg200120ta1syh22j84
cmr8symua000r01mckfmhps3h	cmr4lnhg200120ta1syh22j84
cmr8t3vbi001401mcxwwhatz7	cmr8t3v42001201mc30njqxkr
cmr8t3wa2001k01mc0s4e6iev	cmr4lnhg200120ta1syh22j84
cmr8t3wo3001o01mckjfcdxzn	cmr4lnhg200120ta1syh22j84
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, is_active, created_at, updated_at, avatar_media_id, deleted_at, last_login_at, status) FROM stdin;
cmr4hj9r000008wpb6m1i21us	Super Admin	admin@kdl.com	$2a$12$F9PzXkQPpDbJbSdP72oTs./kysgmzv00HoQTMqtFT7/QWBySZbxjm	SUPER_ADMIN	t	2026-07-03 05:20:50.46	2026-07-03 05:20:50.46	\N	\N	\N	ACTIVE
cmr8s6onl000e01pm3f6bhtzb	E2E Viewer	e2e-viewer-mr8s6o7u-9246@e2e.test	$2a$12$cOOCSV0sZgVuW2PnlXarzOibn1YvwFq4suSd8QY8WZ/oiY3oDZtTm	USER	f	2026-07-06 05:30:03.729	2026-07-06 05:30:03.772	\N	2026-07-06 05:30:03.771	\N	ACTIVE
cmr8s7wox001801pmbc27i3mo	E2E Deleted	e2e-deleted-mr8s7ult-3556@e2e.test	$2a$12$Up9bEPozPmRyfvuBlBNS5.d0I9fvjvF3KSkWm6h.qGHlty5vOOAzS	USER	f	2026-07-06 05:31:00.801	2026-07-06 05:31:00.809	\N	2026-07-06 05:31:00.808	\N	ACTIVE
cmr8s7v0z000o01pmo4kqhzs7	E2E Viewer	e2e-viewer-mr8s7ult-3556@e2e.test	$2a$12$usWUnULT643ofQ80ZrGHDuTlVWecPOKni6YIaHj6j32IQ5hXpWJna	USER	f	2026-07-06 05:30:58.643	2026-07-06 05:31:05.964	\N	2026-07-06 05:31:05.963	\N	ACTIVE
cmr8s7wat001401pmj3dxy1t9	E2E Suspended	e2e-suspended-mr8s7ult-3556@e2e.test	$2a$12$KJsx2iEJHO5EfFOIQWOiIOYvsMZE3Hk4E1SgMHPqq0moScTeecpZ2	USER	f	2026-07-06 05:31:00.293	2026-07-06 05:31:05.976	\N	2026-07-06 05:31:05.976	\N	SUSPENDED
cmr8s97fy002001pm4nsp4vx9	E2E Deleted	e2e-deleted-mr8s95lm-2541@e2e.test	$2a$12$NVt/mqKlzGclYfw9XqckS..dxu3X0pV40ib6WDorFDxiB55OlsQ0u	USER	f	2026-07-06 05:32:01.39	2026-07-06 05:32:01.398	\N	2026-07-06 05:32:01.398	\N	ACTIVE
cmr8s960r001g01pm8ewzxz6n	E2E Viewer	e2e-viewer-mr8s95lm-2541@e2e.test	$2a$12$jZKonoG1NIJ5SHqiIDH8J.6mEnIu0lxlAT.8CEvvWQYNVfayy90vm	USER	f	2026-07-06 05:31:59.547	2026-07-06 05:32:01.535	\N	2026-07-06 05:32:01.535	\N	ACTIVE
cmr8s971v001w01pmecjlzkcu	E2E Suspended	e2e-suspended-mr8s95lm-2541@e2e.test	$2a$12$r./ythN3ywYnWW8rKjty6OIrOMyxgKZIhLVVsvt5deNZ1WDHVAyTK	USER	f	2026-07-06 05:32:00.883	2026-07-06 05:32:01.541	\N	2026-07-06 05:32:01.54	\N	SUSPENDED
cmr8s71b8000j01pm0ux1p0z5	Shape Probe	shape-probe-1@e2e.test	$2a$12$qGUV9DYCTizpfbFe9VggiuklfT5XoIhRxJ3dfd.BZ0VbofhYj.r/W	USER	f	2026-07-06 05:30:20.132	2026-07-06 05:32:17.675	\N	2026-07-06 05:32:17.675	\N	ACTIVE
cmr8sj706002y01pmr6523osw	E2E Deleted	e2e-deleted-mr8sj47g-457@e2e.test	$2a$12$c3BpbBdBgK7vl13MD9iqp.ihpiQZVpEd.gSuTRYFhcZKadXm/2/QO	USER	f	2026-07-06 05:39:47.382	2026-07-06 05:39:47.391	\N	2026-07-06 05:39:47.391	\N	ACTIVE
cmr8sj5ni002e01pm53zdbac1	E2E Viewer	e2e-viewer-mr8sj47g-457@e2e.test	$2a$12$35TBPB2DX0eN9zrNnT448O1/MtGBihC4lGGhOmCCROY/HrEj8TjDq	USER	f	2026-07-06 05:39:45.63	2026-07-06 05:39:47.53	\N	2026-07-06 05:39:47.53	\N	ACTIVE
cmr8sj6lx002u01pm24oofx94	E2E Suspended	e2e-suspended-mr8sj47g-457@e2e.test	$2a$12$v2XQsQBuk30KnnF8Yx1KDeu0Sc/xBhNjU3vG0mmgQZ18TqUz5DCwG	USER	f	2026-07-06 05:39:46.869	2026-07-06 05:39:47.535	\N	2026-07-06 05:39:47.535	\N	SUSPENDED
cmr8sjmtc003u01pme2ymyqmi	E2E Deleted	e2e-deleted-mr8sjkan-7560@e2e.test	$2a$12$7jq4SuTlE9x8XgkJKS/KTuJTNX0mlXDbpUNmGPyvyvPlRxr888m8y	USER	f	2026-07-06 05:40:07.872	2026-07-06 05:40:07.881	\N	2026-07-06 05:40:07.881	\N	ACTIVE
cmr8sjlgr003a01pmhnzdf2k7	E2E Viewer	e2e-viewer-mr8sjkan-7560@e2e.test	$2a$12$Iu5CWxkaFjaqHpG0zh5rYenbSJjMMCKb/eVNzaMvKQ/7hF8YW2eBS	USER	f	2026-07-06 05:40:06.123	2026-07-06 05:40:08.022	\N	2026-07-06 05:40:08.022	\N	ACTIVE
cmr8sjmee003q01pm8t7u478u	E2E Suspended	e2e-suspended-mr8sjkan-7560@e2e.test	$2a$12$FhyDppM0iBxHDlzbPCAkKu1RMDKKB0Dx3cg3t0LWikdwSllW6A5su	USER	f	2026-07-06 05:40:07.334	2026-07-06 05:40:08.027	\N	2026-07-06 05:40:08.027	\N	SUSPENDED
cmr8symua000r01mckfmhps3h	E2E Deleted	e2e-deleted-mr8syjy2-9591@e2e.test	$2a$12$/ojit5zq7mgu0LCjPMSIEe1UJJgwESymm3OexIbpD9D8VfVc2bJSm	USER	f	2026-07-06 05:51:47.746	2026-07-06 05:51:47.757	\N	2026-07-06 05:51:47.755	\N	ACTIVE
cmr8sylh9000701mciabvhq7l	E2E Viewer	e2e-viewer-mr8syjy2-9591@e2e.test	$2a$12$jATr0DbckLBBFQrXrZ57CuVXDc77WSzyc.BArexeHkHKre0SKO//C	USER	f	2026-07-06 05:51:45.981	2026-07-06 05:51:47.896	\N	2026-07-06 05:51:47.895	\N	ACTIVE
cmr8symfv000n01mc2okk2jxo	E2E Suspended	e2e-suspended-mr8syjy2-9591@e2e.test	$2a$12$jhJUfDpbMwVkyJ7Qu/E1HeTxBJbnbk3UTBNN3If7k6zJoBVmrRkam	USER	f	2026-07-06 05:51:47.227	2026-07-06 05:51:47.901	\N	2026-07-06 05:51:47.901	\N	SUSPENDED
cmr8t3wo3001o01mckjfcdxzn	E2E Deleted	e2e-deleted-mr8t3twk-1516@e2e.test	$2a$12$gYxu5dUjWnsC6cktBYIcgeEr5q4Q2nGBm8XtCEqDQnVX2bWM/852i	USER	f	2026-07-06 05:55:53.763	2026-07-06 05:55:53.772	\N	2026-07-06 05:55:53.771	\N	ACTIVE
cmr8t3vbi001401mcxwwhatz7	E2E Viewer	e2e-viewer-mr8t3twk-1516@e2e.test	$2a$12$FoCur99hE3fNhix08dyiiufNwWvmlfm2zSaSZliz4/PL0.g.CclMm	USER	f	2026-07-06 05:55:52.014	2026-07-06 05:55:53.91	\N	2026-07-06 05:55:53.91	\N	ACTIVE
cmr8t3wa2001k01mc0s4e6iev	E2E Suspended	e2e-suspended-mr8t3twk-1516@e2e.test	$2a$12$kedKE58ZlYp5Qm2E2Wh0o.yBi47BOGjvpmNXDjYRHN4zNTjAwNtjK	USER	f	2026-07-06 05:55:53.258	2026-07-06 05:55:53.916	\N	2026-07-06 05:55:53.916	\N	SUSPENDED
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: permission_modules permission_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_modules
    ADD CONSTRAINT permission_modules_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: setting_fields setting_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setting_fields
    ADD CONSTRAINT setting_fields_pkey PRIMARY KEY (id);


--
-- Name: types types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.types
    ADD CONSTRAINT types_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_actor_id_idx ON public.activity_logs USING btree (actor_id);


--
-- Name: activity_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs USING btree (created_at);


--
-- Name: activity_logs_module_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activity_logs_module_idx ON public.activity_logs USING btree (module);


--
-- Name: app_settings_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX app_settings_key_key ON public.app_settings USING btree (key);


--
-- Name: categories_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_is_active_idx ON public.categories USING btree (is_active);


--
-- Name: categories_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_name_idx ON public.categories USING btree (name);


--
-- Name: categories_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);


--
-- Name: categories_type_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX categories_type_id_idx ON public.categories USING btree (type_id);


--
-- Name: media_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_user_id_idx ON public.media USING btree (user_id);


--
-- Name: password_reset_tokens_expires_at_used_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX password_reset_tokens_expires_at_used_idx ON public.password_reset_tokens USING btree (expires_at, used);


--
-- Name: password_reset_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: password_reset_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens USING btree (user_id);


--
-- Name: permission_modules_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permission_modules_name_key ON public.permission_modules USING btree (name);


--
-- Name: permissions_module_id_action_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_module_id_action_key ON public.permissions USING btree (module_id, action);


--
-- Name: permissions_module_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permissions_module_id_idx ON public.permissions USING btree (module_id);


--
-- Name: refresh_tokens_expires_at_revoked_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_expires_at_revoked_idx ON public.refresh_tokens USING btree (expires_at, revoked);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: role_permissions_permission_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions USING btree (permission_id);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: roles_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_slug_key ON public.roles USING btree (slug);


--
-- Name: setting_fields_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX setting_fields_category_id_idx ON public.setting_fields USING btree (category_id);


--
-- Name: setting_fields_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX setting_fields_slug_key ON public.setting_fields USING btree (slug);


--
-- Name: setting_fields_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX setting_fields_sort_idx ON public.setting_fields USING btree (sort);


--
-- Name: setting_fields_type_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX setting_fields_type_id_idx ON public.setting_fields USING btree (type_id);


--
-- Name: types_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX types_is_active_idx ON public.types USING btree (is_active);


--
-- Name: types_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX types_name_idx ON public.types USING btree (name);


--
-- Name: types_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX types_slug_key ON public.types USING btree (slug);


--
-- Name: user_permissions_permission_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_permissions_permission_id_idx ON public.user_permissions USING btree (permission_id);


--
-- Name: user_roles_role_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_roles_role_id_idx ON public.user_roles USING btree (role_id);


--
-- Name: users_deleted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_deleted_at_idx ON public.users USING btree (deleted_at);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: categories categories_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: media media_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: permissions permissions_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.permission_modules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: setting_fields setting_fields_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setting_fields
    ADD CONSTRAINT setting_fields_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: setting_fields setting_fields_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.setting_fields
    ADD CONSTRAINT setting_fields_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.types(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jAGx5yBQUWH7TCeuF7kggmCLUDwshl7CH9qU9vl0Ii1f3BWVPwDFs5m1zndQAYE

