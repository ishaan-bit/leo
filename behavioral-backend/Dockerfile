FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt

# Copy application code
COPY . .

# Run the application (app.py reads PORT from environment)
CMD ["python", "app.py"]
