import importlib.util
import json
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('adapter', Path(__file__).with_name('comfyui_local_adapter.py'))
adapter=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(adapter)

class FakeComfy(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path=='/system_stats': obj={'devices':[{'name':'mock-GPU'}]}
        elif self.path=='/history/local-test-123':obj={'local-test-123':{'outputs':{'node42':{'images':[]}}}}
        else: self.send_error(404); return
        data=json.dumps(obj).encode()
        self.send_response(200);self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_POST(self):
        if self.path!='/prompt': self.send_error(404);return
        data=json.dumps({'prompt_id':'local-test-123'}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)

class AdapterTests(unittest.TestCase):
    def test_reject_remote(self):
        for address in ['https://some-cloud.com','http://192.168.0.1:8188','http://localhost:8188/path']:
            with self.assertRaises(ValueError):adapter.ensure_loopback(address)
    def test_validate_workflow(self):
        with tempfile.TemporaryDirectory() as root:
            p=Path(root)/'workflow.json'
            p.write_text(json.dumps({'1':{'class_type':'EmptyLatentImage','inputs':{}}}))
            self.assertEqual(len(adapter.validate_workflow(p)),1)
            p.write_text(json.dumps({'1':{'inputs':{}}}))
            with self.assertRaises(ValueError):adapter.validate_workflow(p)
    def test_local_api_protocol_mock_only(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),FakeComfy)
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            url=f'http://127.0.0.1:{server.server_port}'
            self.assertEqual(len(adapter.request(url,'/system_stats')['devices']),1)
            response=adapter.request(url,'/prompt',{'prompt':{'1':{'class_type':'X','inputs':{}}}})
            self.assertEqual(adapter.wait_for_result(url,response['prompt_id'],3),{'node42':{'images':[]}})
        finally: server.shutdown();t.join();server.server_close()

if __name__=='__main__':unittest.main()
