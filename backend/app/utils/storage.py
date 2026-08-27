# app/utils/storage.py

import os
import logging
try:
    import boto3
    from botocore.client import Config
except ImportError:
    import subprocess
    import sys
    print("Boto3 package not found. Installing dynamically...")
    subprocess.call([sys.executable, "-m", "pip", "install", "boto3==1.34.84"])
    import boto3
    from botocore.client import Config

logger = logging.getLogger(__name__)

# Normalize configuration variables
MINIO_URL = os.environ.get("MINIO_URL", "http://localhost:9000")
MINIO_USER = os.environ.get("MINIO_ROOT_USER") or os.environ.get("MINIO_USER", "minioadmin")
MINIO_PASSWORD = os.environ.get("MINIO_ROOT_PASSWORD") or os.environ.get("MINIO_PASSWORD", "minioadmin")

def get_s3_client():
    """
    Initializes a boto3 client targeting the MinIO object storage.
    """
    return boto3.client(
        "s3",
        endpoint_url=MINIO_URL,
        aws_access_key_id=MINIO_USER,
        aws_secret_access_key=MINIO_PASSWORD,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1"
    )

def upload_pdf(org_id: str, scan_id: str, pdf_bytes: bytes, template: str) -> bool:
    """
    Uploads a generated PDF report to MinIO in the bucket 'scans' with key '{org_id}/{scan_id}.pdf'.
    Also tags the object with the requested report template metadata.
    """
    bucket_name = "scans"
    object_key = f"{org_id}/{scan_id}.pdf"
    s3 = get_s3_client()
    try:
        # Check bucket existence, create if missing
        try:
            s3.head_bucket(Bucket=bucket_name)
        except Exception:
            logger.info(f"Creating bucket '{bucket_name}' in MinIO...")
            s3.create_bucket(Bucket=bucket_name)
            
        s3.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            Metadata={"template": template}
        )
        logger.info(f"Successfully uploaded PDF to MinIO: {bucket_name}/{object_key} (template: {template})")
        return True
    except Exception as e:
        logger.error(f"Failed to upload PDF to MinIO: {e}")
        return False

def get_pdf(org_id: str, scan_id: str, template: str) -> bytes:
    """
    Downloads a cached PDF report from MinIO scans bucket if it matches the requested template.
    Returns None if cache miss or mismatch.
    """
    bucket_name = "scans"
    object_key = f"{org_id}/{scan_id}.pdf"
    s3 = get_s3_client()
    try:
        # Check object metadata first
        head = s3.head_object(Bucket=bucket_name, Key=object_key)
        meta_template = head.get("Metadata", {}).get("template")
        if meta_template == template:
            logger.info(f"Cache hit: Found matching PDF in MinIO for {object_key} (template: {template})")
            response = s3.get_object(Bucket=bucket_name, Key=object_key)
            return response["Body"].read()
        else:
            logger.info(f"Cache miss: PDF template mismatch. Requested: {template}, Cached: {meta_template}")
            return None
    except Exception as e:
        # head_object throws error if file does not exist
        logger.info(f"Cache miss: PDF not found in MinIO for {object_key} (error: {e})")
        return None
