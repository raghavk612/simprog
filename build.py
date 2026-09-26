import pathlib
root = pathlib.Path(__file__).parent
src = root/'src'
css = (src/'styles.css').read_text()
js = '\n'.join((src/f).read_text() for f in ['engine.js','events.js','media.js','ui.js'])
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:wght@500;600;700&family=Graduate&family=Permanent+Marker&display=swap">'
body = f'''<a class="skip" href="#main">Skip to content</a>
<div id="app"></div>
<div id="modal-host"></div>
<div class="toast-host" id="toasts" aria-live="polite"></div>
<div class="sr-only" id="live" aria-live="polite" aria-atomic="true"></div>
<div class="sr-only" id="live-a" aria-live="assertive" aria-atomic="true"></div>
<noscript><p style="padding:16px">Road to the Championship needs JavaScript turned on.</p></noscript>
<script>
{js}
</script>'''
head = f'<title>Road to the Championship</title>\n<meta name="description" content="A high school basketball coaching simulation: recruit, develop, manage and strategize your way to the State title.">\n{fonts}\n<style>\n{css}\n</style>\n'
# Artifact version (the host adds doctype/head/body)
(root/'dist'/'road-to-the-championship.html').write_text(head + body)
# Standalone offline version (double-click to play, no internet needed)
(root/'dist'/'road-to-the-championship-offline.html').write_text(f'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n{head}</head>\n<body>\n{body}\n</body>\n</html>\n')
print('built', len(head+body)//1024, 'KB')

# GitHub Pages entry point
(root/"index.html").write_text((root/"dist"/"road-to-the-championship-offline.html").read_text())
