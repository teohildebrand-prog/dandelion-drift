"""Boot the game in headless Chromium and fail on any JavaScript error.

Run with:  python3 -m pytest tests/
"""
import functools
import http.server
import os
import pathlib
import threading

import pytest
from playwright.sync_api import sync_playwright

SRC = pathlib.Path(__file__).resolve().parent.parent / "src"
ARTIFACTS = pathlib.Path(os.environ.get("SMOKE_ARTIFACTS", "test-artifacts"))
# Software WebGL so the test also runs on build agents without a GPU.
CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def base_url():
    handler = functools.partial(QuietHandler, directory=str(SRC))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}/"
    server.shutdown()


@pytest.fixture(scope="module")
def page():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=CHROMIUM_ARGS)
        pg = browser.new_page(viewport={"width": 1280, "height": 900})
        yield pg
        browser.close()


def test_game_boots_and_plays(base_url, page):
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("requestfailed", lambda r: "fonts.g" not in r.url and errors.append(f"failed: {r.url}"))

    page.goto(base_url)
    page.wait_for_timeout(2000)
    assert errors == [], "JavaScript errors on load:\n" + "\n".join(errors)
    assert page.is_visible("#title"), "title screen did not show"
    assert not page.is_visible("#glErr"), "WebGL failed to start"

    # Press Start, run forward, jump and open the seed.
    page.click("#title")
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)
    page.keyboard.down("KeyW")
    page.wait_for_timeout(1500)
    page.keyboard.up("KeyW")
    page.keyboard.press("Space")
    page.wait_for_timeout(300)
    page.keyboard.press("Space")
    page.wait_for_timeout(800)

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(ARTIFACTS / "smoke.png"))
    assert not page.is_visible("#title"), "game did not leave the title screen"
    assert errors == [], "JavaScript errors:\n" + "\n".join(errors)
