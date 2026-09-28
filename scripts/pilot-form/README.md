# Pilot form handler (Google Apps Script)

`Code.gs` is the source of the **QCobro Form Handler** Apps Script. It's bound to
the "QCobro Form" Google Sheet (Extensions → Apps Script) and deployed as the web
app that `site/app.js` posts pilot-form submissions to (`ENDPOINT`).

It writes each submission **by header name**: every row-1 header becomes a
column, filled from the matching key of the JSON body (`timestamp` is the save
time). To capture a new form field, send it from `site/app.js` and add a header
with the same name to the sheet. The script doesn't need to change. Headers ending
in `_id` are stored as plain text, because Meta's 18-digit ids would lose precision
as numbers.

This copy is for review and history; the running code lives in Apps Script.

## Changing it

1. Edit `Code.gs` here, then paste it into the Apps Script editor and save.
2. **Test first** on Deploy → Test deployments (the `/dev` URL runs the saved
   code for the owner only): POST a JSON body with and without the attribution
   keys, check the rows, then delete them.
3. Deploy → **Manage deployments** → edit (pencil) the existing "QCobro form
   handler" deployment → Version: **New version** → Deploy.
   Don't use "New deployment": it creates a new `/exec` URL and the site would
   keep posting to the old one.
