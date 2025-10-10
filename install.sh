npm install express
npm install puppeteer
npm install fs-extra
py -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install flask
pip install flask flask-cors requests python-dotenv && python -c "import flask; import flask_cors; import requests; import dotenv; print('Dependencias OK')" && .start_arkaios_full.bat
