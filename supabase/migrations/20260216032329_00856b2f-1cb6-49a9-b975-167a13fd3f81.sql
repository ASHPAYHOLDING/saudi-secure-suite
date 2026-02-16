
-- ═══════════════════════════════════════════
-- ENUM: أدوار التطبيق
-- ═══════════════════════════════════════════
CREATE TYPE public.app_role AS ENUM (
    'owner',
    'admin',
    'manager',
    'hr',
    'accountant',
    'member'
);

-- ═══════════════════════════════════════════
-- 1. TENANTS — الشركات / المستأجرين
-- ═══════════════════════════════════════════
CREATE TABLE public.tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    name_en         TEXT,
    slug            TEXT UNIQUE NOT NULL,
    logo_url        TEXT,
    cr_number       VARCHAR(20),
    vat_number      VARCHAR(15),
    phone           VARCHAR(20),
    email           TEXT,
    address_city    TEXT,
    address_street  TEXT,
    address_zip     VARCHAR(10),
    industry        TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','cancelled')),
    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- ═══════════════════════════════════════════
-- 2. PROFILES — ملفات المستخدمين
-- ═══════════════════════════════════════════
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL DEFAULT '',
    full_name_en    TEXT,
    email           TEXT NOT NULL DEFAULT '',
    phone           VARCHAR(20),
    avatar_url      TEXT,
    job_title       TEXT,
    language        VARCHAR(5) NOT NULL DEFAULT 'ar',
    timezone        TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ═══════════════════════════════════════════
-- 3. TENANT_MEMBERS — العضويات (الأدوار هنا!)
-- ═══════════════════════════════════════════
CREATE TABLE public.tenant_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        app_role NOT NULL DEFAULT 'member',
    invited_by  UUID REFERENCES auth.users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_members_tenant ON tenant_members(tenant_id);
CREATE INDEX idx_members_user ON tenant_members(user_id);
CREATE INDEX idx_members_role ON tenant_members(tenant_id, role);

-- ═══════════════════════════════════════════
-- 4. SUBSCRIPTION_PLANS — خطط الاشتراك (عامة)
-- ═══════════════════════════════════════════
CREATE TABLE public.subscription_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar         TEXT NOT NULL,
    name_en         TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    price_monthly   DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_quarterly DECIMAL(10,2),
    price_yearly    DECIMAL(10,2),
    max_users       INT,
    max_storage_gb  INT,
    max_invoices    INT,
    max_employees   INT,
    features        JSONB NOT NULL DEFAULT '[]',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 5. SUBSCRIPTIONS — اشتراكات الشركات
-- ═══════════════════════════════════════════
CREATE TABLE public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans(id),
    billing_cycle           TEXT NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly','quarterly','yearly')),
    status                  TEXT NOT NULL DEFAULT 'trial'
                            CHECK (status IN (
                                'trial','active','past_due','grace_period',
                                'suspended','cancelled','churned'
                            )),
    trial_ends_at           TIMESTAMPTZ,
    current_period_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,
    stripe_subscription_id  TEXT,
    stripe_customer_id      TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subs_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subs_status ON subscriptions(status);
CREATE INDEX idx_subs_period_end ON subscriptions(current_period_end);

-- ═══════════════════════════════════════════
-- 6. DEPARTMENTS — الأقسام
-- ═══════════════════════════════════════════
CREATE TABLE public.departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    name_en     TEXT,
    manager_id  UUID REFERENCES auth.users(id),
    parent_id   UUID REFERENCES departments(id),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dept_tenant ON departments(tenant_id);
CREATE UNIQUE INDEX idx_dept_name ON departments(tenant_id, name);

-- ═══════════════════════════════════════════
-- HELPER FUNCTIONS — دوال الأمان
-- ═══════════════════════════════════════════

-- دالة: الحصول على tenant_id للمستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.tenant_members
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- دالة: هل المستخدم لديه دور معين
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- دالة: هل المستخدم owner في tenant معين
CREATE OR REPLACE FUNCTION public.is_tenant_owner(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = 'owner'
  )
$$;

-- دالة: هل المستخدم admin أو أعلى
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
$$;

-- دالة: هل المستخدم عضو في tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  )
$$;

-- دالة: الحصول على دور المستخدم في tenant
CREATE OR REPLACE FUNCTION public.get_user_role(_tenant_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.tenant_members
  WHERE user_id = auth.uid()
    AND tenant_id = _tenant_id
  LIMIT 1
$$;

-- ═══════════════════════════════════════════
-- TRIGGER: إنشاء profile تلقائي عند التسجيل
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════
-- TRIGGER: تحديث updated_at تلقائياً
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- RLS: تفعيل + سياسات الأمان
-- ═══════════════════════════════════════════

-- TENANTS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id));

CREATE POLICY "Owners can update own tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(id));

CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can delete own tenant"
  ON public.tenants FOR DELETE TO authenticated
  USING (public.is_tenant_owner(id));

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in same tenant"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id()
    OR id = auth.uid()
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "System creates profiles on signup"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- TENANT_MEMBERS
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view same tenant members"
  ON public.tenant_members FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can add members"
  ON public.tenant_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(tenant_id)
    OR (user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Admins can update member roles"
  ON public.tenant_members FOR UPDATE TO authenticated
  USING (
    public.is_tenant_admin(tenant_id)
    AND user_id != auth.uid()
  );

CREATE POLICY "Admins can remove members"
  ON public.tenant_members FOR DELETE TO authenticated
  USING (
    public.is_tenant_admin(tenant_id)
    AND user_id != auth.uid()
  );

-- SUBSCRIPTION_PLANS (عامة للقراءة)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- SUBSCRIPTIONS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own tenant subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Owners can manage subscription"
  ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_owner(tenant_id));

CREATE POLICY "Owners can update subscription"
  ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(tenant_id));

-- DEPARTMENTS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view departments"
  ON public.departments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Admins can create departments"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "Admins can delete departments"
  ON public.departments FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id));

-- ═══════════════════════════════════════════
-- بيانات أولية: خطط الاشتراك
-- ═══════════════════════════════════════════
INSERT INTO public.subscription_plans (name_ar, name_en, slug, price_monthly, price_quarterly, price_yearly, max_users, max_storage_gb, max_invoices, max_employees, features, sort_order)
VALUES
  ('أساسي', 'Starter', 'starter', 199, 537, 1910, 5, 5, 50, NULL, '["invoicing"]', 1),
  ('احترافي', 'Professional', 'professional', 499, 1347, 4790, 25, 50, NULL, 25, '["invoicing","accounting","hr"]', 2),
  ('مؤسسي', 'Enterprise', 'enterprise', 0, NULL, NULL, NULL, NULL, NULL, NULL, '["invoicing","accounting","hr","recruitment","api"]', 3);
