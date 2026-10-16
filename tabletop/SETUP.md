# Crawl Tabletop: online play setup

The tabletop works straight away on one computer: every tab you open in the same browser joins the same table. That's handy for testing and for in-person games on one screen.

To play with people on their own devices, the tabletop needs a free Firebase project. Firebase is Google's real-time database. It keeps everyone's map, tokens, chat and sheets in sync. You do this once, and it takes about 10 minutes.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Create a project** and name it something like `crawl-tabletop`. You can turn Google Analytics off.
3. On the project home page, click the **</>** (Web) icon to add a web app. Name it `Crawl Tabletop`. You don't need Firebase Hosting.
4. Firebase shows a block of code with `const firebaseConfig = { ... }`. Copy everything between the `{ }`. Those are your settings.

## 2. Turn on the database

1. In the left menu, open **Build → Realtime Database** and click **Create Database**.
2. Pick the location closest to your group, then choose **Start in locked mode**.
3. Open the **Rules** tab, replace the rules with the following, and click **Publish**:

```json
{
  "rules": {
    "games": {
      "$game": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

4. If your copied settings don't include a `databaseURL` line, copy the database address shown at the top of the Data tab (it ends in `firebasedatabase.app` or `firebaseio.com`). Add it to your settings as `databaseURL: "https://…"`.

## 3. Turn on anonymous sign-in

Players don't need accounts. The tabletop signs each browser in anonymously.

1. Open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, choose **Anonymous**, switch it on, and save.
3. Under **Settings → Authorized domains**, add `brodywoe-svg.github.io`.

## 4. Give the settings to the tabletop

You can do this in either of two ways.

- **Just for you (quickest).** Open the tabletop, open or create any game, go to the **Settings** tab, paste the settings into **Online play**, and click **Save and reload**. Invite links you copy afterwards carry the settings, so your players don't need to paste anything.
- **For everyone, permanently.** Save the settings as `tabletop/config.json` in the website's repository, for example:

```json
{
  "apiKey": "…",
  "authDomain": "crawl-tabletop.firebaseapp.com",
  "databaseURL": "https://crawl-tabletop-default-rtdb.firebaseio.com",
  "projectId": "crawl-tabletop",
  "appId": "…"
}
```

The Firebase web settings aren't a password: they only say which project to talk to, and the database rules above decide who may use it. Anyone with an invite link can join that game.

## Notes

- The free Firebase plan is plenty for a gaming group. Map pictures are shrunk before they're shared, but very many large maps will use up storage faster.
- Games made in "this computer" mode stay in that browser. They don't move online.
- Crawl materials (races, classes, backgrounds, spells, items, glossary) are downloaded from the Crawl website and kept in the browser. The lobby checks for updates each time, and **Settings → Crawl materials** checks during a game.
