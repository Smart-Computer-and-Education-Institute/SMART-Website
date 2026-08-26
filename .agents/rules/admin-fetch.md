# Admin Panel Fetch Calls Must Always Check `res.ok`

In any admin panel JS file (`admin/*.js`), every `fetch` call for a mutating action (`POST`, `PUT`, `DELETE`) MUST check `res.ok` before showing a success toast or updating UI state. If `!res.ok`, show a danger toast with the server's error message:

```javascript
const res = await fetch(...);
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  showToast(err.error || "Action failed — please try again.", "danger");
  return;
}
showToast("Success message");
```

Similarly, `GET` calls that populate arrays must guard against non-array responses:

```javascript
const data = await res.json();
items = Array.isArray(data) ? data : [];
```

Failure to do this causes silent failures where the UI claims success even if the server returned an error (e.g. 400, 401, 404, 500).
