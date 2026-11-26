import json, os, re, sys, glob

ROOT = "/Users/bennywen/project/bennywen/openspec-expert/workbuddy-team"
ok, fail = [], []

def check(cond, msg):
    (ok if cond else fail).append(msg)

def load_json(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)

def frontmatter(p):
    txt = open(p, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
    if not m:
        return None, txt
    raw = m.group(1)
    try:
        import yaml
        return yaml.safe_load(raw), txt
    except Exception:
        d = {}
        for line in raw.splitlines():
            if ":" in line and not line.startswith((" ", "\t")):
                k, v = line.split(":", 1)
                d[k.strip()] = v.strip()
        return d, txt

pj_path = os.path.join(ROOT, ".codebuddy-plugin", "plugin.json")
check(os.path.isfile(pj_path), "plugin.json 存在")
pj = load_json(pj_path)

# 基础字段
check(re.fullmatch(r"[a-z0-9-]+", pj.get("name", "")) is not None, f"name 合法: {pj.get('name')}")
check(re.fullmatch(r"\d+\.\d+\.\d+", pj.get("version", "")) is not None, f"version 语义化: {pj.get('version')}")
check(bool(pj.get("description")) and re.search(r"[A-Za-z]", pj.get("description", "")), "description 为英文")
check(bool(pj.get("author", {}).get("name")) and bool(pj.get("author", {}).get("email")), "author 含 name+email")

# agents 路径
agents = pj.get("agents", [])
for rel in agents:
    check(os.path.isfile(os.path.join(ROOT, rel)), f"agents 路径存在: {rel}")

check(pj.get("expertType") in ("agent", "team"), f"expertType: {pj.get('expertType')}")
check(pj.get("expertType") == "team", "本包为 Team 型")

# 一致性 1：agentName = 主理人文名 = frontmatter name
agentName = pj.get("agentName")
lead_rel = f"./agents/{agentName}.md"
check(os.path.isfile(os.path.join(ROOT, lead_rel)), f"主理人文件存在: {lead_rel}")
fm_lead, body_lead = frontmatter(os.path.join(ROOT, lead_rel))
check(fm_lead and fm_lead.get("name") == agentName, f"主理人 frontmatter.name == agentName ({agentName})")
check(agentName != "team-lead", "主理人未使用通用名 team-lead")
check(agentName.endswith("-team-lead"), "主理人名带 team-lead 后缀")

# 展示字段
for field in ("displayName", "profession", "displayDescription", "defaultInitPrompt"):
    v = pj.get(field, {})
    check(isinstance(v, dict) and bool(v.get("en")) and bool(v.get("zh")), f"{field} 中英文齐全")

zh_desc = pj.get("displayDescription", {}).get("zh", "")
check(40 <= len(zh_desc) <= 50, f"displayDescription.zh 长度 {len(zh_desc)}（要求 40-50）")

# 头像
team_avatar = pj.get("avatar")
check(os.path.isfile(os.path.join(ROOT, team_avatar)), f"团队头像存在: {team_avatar}")

# 分类
cats = {"01-ProductDesign","02-Engineering","03-GameSpatial","04-DataAI","05-MarketingGrowth",
        "06-ContentCreative","07-SalesCommerce","08-FinanceInvestment","09-OperationsHR",
        "10-ProjectQuality","11-SecurityCompliance","12-IndustryConsultant","13-TencentZone",
        "14-WorldWise","15-Education"}
check(pj.get("categoryId") in cats, f"categoryId 合法: {pj.get('categoryId')}")

check(pj.get("plugin") == pj.get("name"), "plugin == name")

tags = pj.get("tags", [])
check(3 <= len(tags) <= 5, f"tags 数量 {len(tags)}（要求 3-5）")
for t in tags:
    check(bool(t.get("en")) and bool(t.get("zh")), f"tag 中英文: {t}")

qps = pj.get("quickPrompts", [])
check(len(qps) == 3, f"quickPrompts 数量 {len(qps)}（要求 3）")
for q in qps:
    check(bool(q.get("en")) and bool(q.get("zh")), "quickPrompt 中英文齐全")
dip = pj.get("defaultInitPrompt", {})
check(any(q.get("zh") == dip.get("zh") for q in qps), "defaultInitPrompt 与 quickPrompts 之一一致")

# teamInfo
ti = pj.get("teamInfo", {})
check(ti.get("leadAgent") == agentName, "teamInfo.leadAgent == agentName")
member_ids = ti.get("memberAgents", [])
check(len(member_ids) >= 1, f"memberAgents 数量 {len(member_ids)}")

# members
members = pj.get("members", [])
ids = [m.get("id") for m in members]
check(agentName in ids, "主理人出现在 members 中")
lead_m = [m for m in members if m.get("id") == agentName]
check(lead_m and lead_m[0].get("role") == "lead", "主理人 role == lead")
check(sorted(ids) == sorted([agentName] + member_ids), "members 与 teamInfo 成员集合一致")
for m in members:
    for f in ("id", "name", "profession", "avatar", "role"):
        check(m.get(f) is not None, f"member {m.get('id')} 有 {f}")
    check(os.path.isfile(os.path.join(ROOT, m.get("avatar", ""))), f"成员头像存在: {m.get('avatar')}")
    check(m.get("role") in ("lead", "member"), f"member {m.get('id')} role 合法")

# settings.json
sp = os.path.join(ROOT, "settings.json")
check(os.path.isfile(sp), "settings.json 存在")
if os.path.isfile(sp):
    check(load_json(sp).get("agent") == agentName, "settings.json agent == agentName")

# skills
for rel in pj.get("skills", []):
    check(os.path.isfile(os.path.join(ROOT, rel, "SKILL.md")), f"skill 有 SKILL.md: {rel}")

# Agent MD 检查
all_md = glob.glob(os.path.join(ROOT, "agents", "*.md"))
check(len(all_md) == len(agents), f"agents/ 下 MD 数量 {len(all_md)} 与 plugin.json 一致")
for p in all_md:
    base = os.path.basename(p)[:-3]
    fm, body = frontmatter(p)
    check(fm is not None, f"{base} frontmatter 可解析")
    if not fm:
        continue
    check(fm.get("name") == base, f"{base} frontmatter.name 与文件名一致")
    check(bool(fm.get("description")), f"{base} 有 description")
    check(bool(re.search(r"[A-Za-z]", str(fm.get("description", "")))), f"{base} description 为英文")
    check("tools" not in fm, f"{base} 未声明 tools 字段")
    for f in ("displayName", "profession"):
        v = fm.get(f)
        check(isinstance(v, dict) and bool(v.get("en")) and bool(v.get("zh")), f"{base} {f} 中英文齐全")

# 主理人正文：列出成员 + 铁律
for mid in [agentName] + member_ids:
    check(mid in body_lead, f"主理人正文提及成员 {mid}")
check("团队协作机制（铁律）" in body_lead, "主理人含「团队协作机制（铁律）」章节")
check("严禁行为" in body_lead, "主理人含「严禁行为」")

# 自建工具
wrapper = os.path.join(ROOT, "bin", "wbspec")
impl = os.path.join(ROOT, "bin", "wbspec.cjs")
check(os.path.isfile(wrapper), "bin/wbspec 入口存在")
check(os.access(wrapper, os.X_OK), "bin/wbspec 有可执行权限")
check(os.path.isfile(impl), "bin/wbspec.cjs 实现存在")
check(not os.path.exists(os.path.join(ROOT, "bin", "vendor")), "包内不存在 vendor 目录")
if os.path.isfile(impl):
    src = open(impl, encoding="utf-8").read()
    mods = set(__import__("re").findall(r"require\(['\"]([^'\"]+)['\"]\)", src))
    allowed = {"fs", "path", "crypto", "os", "child_process"}
    check(mods and mods.issubset(allowed), f"wbspec 仅依赖 Node 内置模块: {sorted(mods)}")

# 协议资产
proto = os.path.join(ROOT, "skills", "workbuddy-spec-pipeline", "references", "protocol")
for f in ("schema.json", "protocol.md", "SOURCE.md"):
    check(os.path.isfile(os.path.join(proto, f)), f"协议资产存在: {f}")
for f in ("proposal.md", "spec.md", "design.md", "tasks.md"):
    check(os.path.isfile(os.path.join(proto, "templates", f)), f"协议模板存在: {f}")
try:
    schema = load_json(os.path.join(proto, "schema.json"))
    ids = [a.get("id") for a in schema.get("artifacts", [])]
    check(ids == ["proposal", "specs", "design", "tasks"], f"依赖图产物顺序正确: {ids}")
except Exception as exc:  # noqa: BLE001
    fail.append(f"schema.json 解析失败: {exc}")

# 移植的参考文档
ref_dir = os.path.join(ROOT, "skills", "workbuddy-spec-pipeline", "references", "openspec-skills")
for f in ("explore.md", "propose.md", "apply.md", "archive.md"):
    p = os.path.join(ref_dir, f)
    check(os.path.isfile(p), f"参考文档存在: {f}")
    if os.path.isfile(p):
        txt = open(p, encoding="utf-8").read()
        for bad in ("AskUserQuestion", "TodoWrite", "subagent_type", "openspec-sync-specs"):
            check(bad not in txt, f"{f} 无失效引用 {bad}")

# 头像规格
try:
    from PIL import Image
    for p in glob.glob(os.path.join(ROOT, "avatars", "*")):
        im = Image.open(p)
        size_kb = os.path.getsize(p) / 1024
        check(im.size == (512, 512), f"{os.path.basename(p)} 尺寸 {im.size}")
        check(size_kb <= 500, f"{os.path.basename(p)} {size_kb:.0f}KB <= 500KB")
        check(p.lower().endswith((".png", ".jpg", ".jpeg")), f"{os.path.basename(p)} 格式合规")
except ImportError:
    fail.append("PIL 不可用，跳过头像校验")

print(f"\n通过 {len(ok)} 项，失败 {len(fail)} 项\n")
for m in fail:
    print("  [FAIL]", m)
if not fail:
    for m in ok:
        print("  [OK]", m)
sys.exit(1 if fail else 0)
