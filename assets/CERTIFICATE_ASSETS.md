# Automatic Tournament Certificate Assets

The certificate engine uses two fixed assets.

1. `assets/certificate-template.png`
   The approved reusable landscape certificate background.

2. `assets/certificate-signature.png`
   The approved signature image.

The generator does not change the background design. It draws the student name, award title, tournament name, event date, signature and certificate number over the fixed template.

The assets are intentionally kept outside the JavaScript source so the certificate design stays replaceable without changing the generator.

After the files are present, run `sql/20261005_tournament_certificates.sql` in Supabase before generating certificates.
