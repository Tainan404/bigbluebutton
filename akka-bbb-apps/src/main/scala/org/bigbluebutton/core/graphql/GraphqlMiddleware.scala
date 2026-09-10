package org.bigbluebutton.core.graphql

import org.bigbluebutton.SystemConfiguration
import org.slf4j.LoggerFactory

import java.net.{ URI, URLEncoder }
import java.net.http.{ HttpClient, HttpRequest, HttpResponse }
import java.nio.charset.StandardCharsets
import java.time.Duration

object GraphqlMiddleware extends SystemConfiguration {

  val logger = LoggerFactory.getLogger(this.getClass)

  // Reuse a single HttpClient (it is thread-safe): creating a new instance per request
  // spawns an extra selector thread each time and makes every call slower, which matters
  // because these requests run inside the meeting actor (e.g. one request per locked
  // viewer when lock settings change)
  private val client = HttpClient.newHttpClient()

  def requestGraphqlReconnection(sessionTokens: Vector[String], reason: String): Unit = {
    for {
      sessionToken <- sessionTokens
    } yield {
      val encodedReason = URLEncoder.encode(reason, StandardCharsets.UTF_8.toString)
      val url = s"${graphqlMiddlewareAPI}/graphql-reconnection?sessionToken=$sessionToken&reason=$encodedReason"

      val request = HttpRequest.newBuilder()
        .timeout(Duration.ofSeconds(5))
        .uri(URI.create(url))
        .GET()
        .build()

      val response = client.send(request, HttpResponse.BodyHandlers.ofString())
      logger.debug(s"Graphql reconnection requested for ${sessionToken}: (${url}).")

      if (response.statusCode() != 200) {
        logger.error(s"Error on requesting graphql reconnection for ${sessionToken}. Response Code: ${response.statusCode()}")
      }
    }
  }
}
