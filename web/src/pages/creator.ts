/* creator.html: still runs the old site's scripts unchanged, bundled by web/vite/legacy-pages.ts.
   Its styles are <link>ed in the page's <head>, in the order the old build stacked them.
   cloud-characters comes first, so window.crawlCloud exists before the Creator's first save (it does nothing unless Supabase is on). */
import "../ui/cloud-characters";
import "virtual:legacy/creator";
