import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('activate', ROOT / 'scripts/activate.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
SNIPPET = (ROOT / 'scripts/menu.caddyfile').read_text()
APP = '''\tredir /MakoLrcStudio /MakoLrcStudio/ 308
\thandle /MakoLrcStudio/* {
\t\theader Cache-Control no-cache
\t\tfile_server
\t}
'''
CONFIG = '''other.example {
\treverse_proxy 127.0.0.1:3000
}
# >>> MakoLrcStudio deploy block
tool.talium.site {
\troot * /var/www/tool.talium.site
''' + APP + '''\thandle {
\t\trespond 404
\t}
}
# <<< MakoLrcStudio deploy block <<<
'''


class ConfigMergeTests(unittest.TestCase):
    def test_only_adds_the_menu(self):
        updated = module.merge_config(CONFIG, SNIPPET)
        self.assertIn(APP, updated)
        self.assertTrue(updated.startswith(CONFIG.split(module.MAKO_BEGIN)[0]))
        self.assertEqual(updated.replace(SNIPPET.rstrip() + '\n\n', ''), CONFIG)

    def test_redeployment_is_idempotent(self):
        first = module.merge_config(CONFIG, SNIPPET)
        self.assertEqual(module.merge_config(first, SNIPPET), first)

    def test_refuses_unknown_and_ambiguous_sites(self):
        for config in [CONFIG.replace('tool.talium.site {', 'wrong.example {'), CONFIG + CONFIG, CONFIG.replace('respond 404', 'reverse_proxy :3000'), CONFIG.replace(APP, ''), CONFIG + module.MAKO_BEGIN]:
            with self.subTest(config=config):
                with self.assertRaises(ValueError):
                    module.merge_config(config, SNIPPET)

    def test_refuses_broken_menu_markers(self):
        first = module.merge_config(CONFIG, SNIPPET)
        with self.assertRaises(ValueError):
            module.merge_config(first.replace(module.END, ''), SNIPPET)


if __name__ == '__main__':
    unittest.main()
