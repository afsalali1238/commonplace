import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { transitionType } from "./lib/mainRoutes";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Every navigation runs inside document.startViewTransition where the
    // browser supports it (falls back to a plain navigation elsewhere). The
    // type tells the CSS whether we're going deeper into the IA, coming back
    // out, or moving sideways between tabs — see styles.css "Route
    // transitions" and lib/mainRoutes.ts routeDepth().
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) => [
        transitionType(fromLocation?.pathname, toLocation.pathname),
      ],
    },
  });

  return router;
};
