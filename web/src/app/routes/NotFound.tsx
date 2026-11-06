/* Any address the app doesn't know. */
import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="wrap condwrap">
      <h1>Page not found</h1>
      <p>There's nothing at this address. <Link to="/">Go to the home page</Link>.</p>
    </div>
  );
}
