app = Flask(__name__)
CORS(app)

"""SSM"""
def get_ssm_param(name, secure=True):
    ssm = boto3.client("ssm", region_name="eu-central-1")
    response = ssm.get_parameter(Name=name, WithDecryption=secure)
    return response["Parameter"]["Value"]
 if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

    # Cargar secretos desde SSM (producción)
api_key = os.environ["OPENAI_API_KEY"] = get_ssm_param("/grantify/openai/api_key")
organization_id = os.environ["OPENAI_ORG_ID"] = get_ssm_param("/grantify/openai/org_id", secure=False)