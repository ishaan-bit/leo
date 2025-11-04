"""
Setup configuration for Leo Enrichment Worker
"""
from setuptools import setup, find_packages

setup(
    name="leo-enrichment-worker",
    version="2.0.0",
    description="Leo enrichment worker with Willcox Feelings Wheel v2.0.0",
    packages=find_packages(),
    py_modules=["worker"],  # Include worker.py as a top-level module
    include_package_data=True,
    package_data={
        'src': ['data/*.json'],
    },
    install_requires=[
        # Core dependencies (from requirements.txt)
        "redis>=5.0.0",
        "requests>=2.31.0",
        "python-dotenv>=1.0.0",
        "httpx>=0.27.0",
    ],
    python_requires=">=3.10",
)
