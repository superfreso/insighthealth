# ============================================================
# GUÍA: Cloudflare Worker como Proxy Seguro
# InsightHealth — Edwar
# ============================================================

## ¿Para qué sirve esto?

Sin proxy: Tu celular → Gemini API (con tu key expuesta en el código)
Con proxy:  Tu celular → Tu Worker → Gemini API (la key nunca llega al celular)

El Worker es un mini servidor que vive en los servidores de Cloudflare.
Es GRATIS hasta 100,000 requests por día.

## PASO 1 — Crear cuenta en Cloudflare

1. Ve a https://dash.cloudflare.com
2. Crea una cuenta gratuita (solo necesitas email)
3. Confirma tu email

## PASO 2 — Crear el Worker

1. En el dashboard, ve a "Workers & Pages" en el menú izquierdo
2. Toca "Create application"
3. Toca "Create Worker"
4. Ponle el nombre: "insighthealth-proxy"
5. Toca "Deploy" (no importa el código por ahora)

## PASO 3 — Editar el código del Worker

1. Después de crear, toca "Edit code"
2. BORRA todo el código que aparece
3. Pega EXACTAMENTE el siguiente código:

```javascript
// ============================================================
// InsightHealth — Cloudflare Worker Proxy
// 
// Este Worker recibe la foto desde tu celular,
// llama a Gemini con la API key guardada acá,
// y devuelve el resultado.
//
// La API key NUNCA llega al celular.
// ============================================================

export default {
  async fetch(request, env) {
    
    // Permitir solicitudes desde cualquier origen (CORS)
    // CORS = política del navegador que controla qué sitios
    // pueden llamar a tu servidor
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Responder al "preflight" que hace el navegador antes de la llamada real
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Solo POST permitido", { status: 405 });
    }

    try {
      // Recibir datos del celular
      const body = await request.json();
      const { base64, mimeType, prompt } = body;

      if (!base64 || !mimeType || !prompt) {
        return new Response(
          JSON.stringify({ error: "Faltan campos: base64, mimeType, prompt" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // La API key está guardada como variable de entorno en Cloudflare
      // (la configuras en el Paso 4, nunca aparece en el código)
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GEMINI_API_KEY no configurada en el Worker" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Llamar a Gemini desde el servidor (no desde el celular)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400
          }
        })
      });

      if (!geminiResponse.ok) {
        const errData = await geminiResponse.json();
        return new Response(
          JSON.stringify({ error: errData.error?.message || "Error de Gemini" }),
          { status: geminiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const geminiData = await geminiResponse.json();
      const resultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Devolver solo el texto de respuesta al celular
      return new Response(
        JSON.stringify({ result: resultText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Error interno: " + err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};
```

4. Toca "Save and Deploy"

## PASO 4 — Agregar tu API key como variable secreta

1. Ve a tu Worker → "Settings" → "Variables"
2. En "Environment Variables", toca "Add variable"
3. Nombre: GEMINI_API_KEY
4. Valor: [tu API key de Gemini, ej: AIzaSy...]
5. Toca "Encrypt" para que quede encriptada
6. Toca "Save and deploy"

## PASO 5 — Copiar la URL del Worker

1. Ve a tu Worker → pestaña "Triggers"
2. Copia la URL que aparece, parecida a:
   https://insighthealth-proxy.TU-USUARIO.workers.dev

3. Abre InsightHealth en tu celular
4. Ve a ⚙️ Config → "Proxy Cloudflare"
5. Pega esa URL
6. Toca "Guardar y comenzar"

## ✅ Listo

Tu app ahora usa el proxy. La API key nunca sale de Cloudflare.

## Verificar que funciona

Puedes probar el Worker directamente con:
curl -X POST https://TU-URL.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"base64":"test","mimeType":"image/jpeg","prompt":"test"}'

Debería devolver un error de imagen inválida (normal), 
pero si devuelve JSON significa que el Worker está funcionando.

## Costos del Worker

- Gratis: 100,000 requests/día
- Con 3 análisis/día = 90 requests/mes
- Estás muy lejos del límite gratuito
