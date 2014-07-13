/**
 * @apiDefinePermission developer Registered developer access rights needed. 
 * Please request the <code>client_id</code> and <code>client_secret</code> from http://kodekreatif.co.id
 *
 * @apiVersion 0.3.0
 */

 /**
 * @apiDefinePermission token A valid access token needed. 
 * Please follow the authorization flow to get a valid <code>access_token</code>
 *
 * @apiVersion 0.3.0
 */

/**
 * @api {get} /oauth2/authorize 1. Start Authorization Flow
 * @apiVersion 0.3.0
 * @apiName StartAuthorizationFlow
 * @apiGroup Authorization
 * @apiPermission developer
 *
 * @apiDescription This starts the OAuth 2.0 authorization flow. This isn't an API call—it's the web page that lets the user sign in to siMAYA and authorize your app.
 * 
 * @apiParam {String} response_type Supported response type <code>{'code'}</code>
 * @apiParam {String} dialog_type Supported dialog type <code>{'mobile'}</code>
 * @apiParam {String} redirect_uri Predefined redirect uri, a special value for <code>redirect_uri</code> i.e. <code>/oauth2/callback</code> is provided, hence developer doesn't have to deploy a server side app for retrieving access token.
 * @apiParam {String} scope The data scope <code>{'all'}</code>
 * @apiParam {String} client_id The client identification
 * @apiParam {String} client_secret The client secret
 *
 * @apiExample URL Structure:
 * // DEVELOPMENT
 * http://ayam.vps1.kodekreatif.co.id/oauth2/authorize
 * 
 * @apiExample Example usage:
 * var ROOT_URL = "http://client_id:client_secret@ayam.vps1.kodekreatif.co.id";
 * window.open(ROOT_URL + "/oauth2/authorize?response_type=code&dialog_type=mobile&redirect_uri=/oauth2/callback&scope=all&client_id=client_id");
 *
 */

 /**
 * @api {post} /oauth2/token 2. Request Access Token
 * @apiVersion 0.3.0
 * @apiName RequestForAccessToken
 * @apiGroup Authorization
 * @apiPermission developer
 *
 * @apiDescription This endpoint only applies to apps using the authorization code flow. An app calls this endpoint to acquire a bearer token once the user has authorized the app. If you use the special <code>redirect_uri</code>, you don't need this.
 * 
 * @apiParam {String} code The code acquired by directing users to <code>/oauth2/authorize?response_type=code</code>.
 * @apiParam {String} grant_type The grant type, which must be <code>authorization_code</code>
 * @apiParam {String} redirect_uri  Only used to validate that it matches the original <code>/oauth2/authorize</code>, not used to redirect again.
 * @apiParam {String} client_id The client identification
 * @apiParam {String} client_secret The client secret
 *
 * @apiExample URL Structure:
 * // DEVELOPMENT
 * http://ayam.vps1.kodekreatif.co.id/oauth2/token
 * 
 */

 


 

