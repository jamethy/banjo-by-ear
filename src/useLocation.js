import { useEffect, useState } from "react";
import { parseRoute } from "./routes";

const read = () => ({
  pathname: window.location.pathname,
  ...parseRoute(window.location.pathname),
});

export default function useLocation() {
  const [location, setLocation] = useState(read);
  useEffect(() => {
    const pop = () => setLocation(read());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const navigate = (pathname, { replace = false } = {}) => {
    if (pathname !== window.location.pathname)
      window.history[replace ? "replaceState" : "pushState"](
        null,
        "",
        pathname,
      );
    const next = read();
    setLocation(next);
    return next;
  };
  return [location, navigate];
}
