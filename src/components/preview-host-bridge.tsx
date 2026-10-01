/**
 * Mount once near the top of the tree so the Grok preview chrome can drive
 * navigation. Noops when the app is not embedded.
 */
import { useEffect } from "react";
import { installPreviewHostBridge } from "@/lib/preview-host-bridge";

export function PreviewHostBridge() {
  useEffect(() => {
    return installPreviewHostBridge({
      navigate: (path) => {
        const url = new URL(path, window.location.origin);
        if (url.pathname.endsWith(".html")) {
          window.location.assign(`${url.pathname}${url.search}${url.hash}`);
          return;
        }
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.pushState(window.history.state, "", next);
        if (url.hash) {
          const id = url.hash.slice(1);
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo(0, 0);
        }
        window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      },
      getRoutePaths: () => ["/", "/webllm-test.html"],
    });
  }, []);

  return null;
}
