"""Find one exact-name group containing the configured Feishu application bot.

Usage: python -m scripts.find_feishu_chat 小茶日记
Only matching group IDs are printed; app credentials and tokens are never logged.
"""

from __future__ import annotations

import argparse

import httpx

from apps.api.app.config import Settings


def _checked_payload(response: httpx.Response) -> dict:
    payload = response.json()
    if response.status_code >= 400:
        import re
        scopes = sorted(set(re.findall(r"im:[a-z0-9_:]+", str(payload))))
        raise RuntimeError(
            f"飞书 API HTTP {response.status_code}, code={payload.get('code')}, "
            f"missing_scopes={','.join(scopes) or '未在响应中标明'}"
        )
    if payload.get("code") != 0:
        raise RuntimeError(f"飞书 API 返回 code={payload.get('code')}")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("group_name", help="exact target group name")
    args = parser.parse_args()
    settings = Settings.from_env()
    if not settings.feishu_app_id or not settings.feishu_app_secret:
        raise SystemExit("请先在本地 .env 配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET")

    token_payload = _checked_payload(httpx.post(
        "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": settings.feishu_app_id, "app_secret": settings.feishu_app_secret},
        timeout=10,
    ))
    token = token_payload.get("tenant_access_token")
    if not token:
        raise SystemExit("飞书没有返回 tenant_access_token")

    matches: list[str] = []
    page_token = ""
    while True:
        params = {"page_size": 100}
        if page_token:
            params["page_token"] = page_token
        payload = _checked_payload(httpx.get(
            "https://open.feishu.cn/open-apis/im/v1/chats", params=params,
            headers={"Authorization": f"Bearer {token}"}, timeout=10,
        ))
        data = payload.get("data") or {}
        matches.extend(item["chat_id"] for item in data.get("items", [])
                       if item.get("name") == args.group_name and item.get("chat_id"))
        if not data.get("has_more"):
            break
        page_token = data.get("page_token") or ""
        if not page_token:
            raise SystemExit("飞书分页未返回 page_token，无法确认群列表完整")
    print(f"matching_groups={len(matches)}")
    for chat_id in matches:
        print(f"chat_id={chat_id}")


if __name__ == "__main__":
    main()
