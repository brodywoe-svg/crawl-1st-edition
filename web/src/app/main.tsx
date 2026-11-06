/* The React app (dev/planning/react-migration.md): the screens at /, and soon the play sheet, characters and campaigns.
   Pages not moved into it yet (spells.html, creator.html…) are separate HTML files, built alongside (vite.config.ts).
   Vercel sends any other address without a file extension here (vercel.json), and the router picks the screen. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, type RouteObject } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Layout } from "./components/Layout";
import { Home } from "./routes/Home";
import { NotFound } from "./routes/NotFound";
import "../ui/cloud-characters"; // keeps this browser's characters in step with your account, on every screen

/** The app's screens. Layout also uses this list to tell links to these screens from links to other pages. */
const screens: RouteObject[] = [
  { index: true, element: <Home /> },
  { path: "index.html", element: <Home /> }, // the nav's Home link, and old bookmarks
  { path: "*", element: <NotFound /> },
];
const routes: RouteObject[] = [{ path: "/", element: <Layout routes={screens} />, children: screens }];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={createBrowserRouter(routes)} />
  </StrictMode>,
);
