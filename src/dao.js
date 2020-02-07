var driver = null
const { Client } = require('virtuoso-sparql-client');

exports.init = function () {
  /* Virtuoso sparql endpoint */
  driver = new Client('http://localhost:8890/sparql');
  driver.setOptions(
    "application/json",
    {
      "eu": "http://www.semanticweb.org/european_union#",
      "dcterms": "http://purl.org/dc/terms/",
      "dbp": "http://dbpedia.org/resource/"
    },
    "http://localhost:8890/DAV/european_union"
  );

  /* DBpedia sparql endpoint */
  driverDBpedia = new Client('http://dbpedia.org/sparql');
  driverDBpedia.setOptions(
    "application/json",
    {
      "dbp": "http://dbpedia.org/resource/"
    }
  );
}

/**
 * SEARCH
 * cerca Procedure che rispettano vincoli di query e filter
 * se query e filter non sono specificati ritorna tutte le Procedure.
 * @param {*} query una string contenente una parte o l'interezza del titolo delle Procedure o del loro ID.
 * @param {*} filter un plain object contenenti i filtri di ricerca (status e/o type).
 */
exports.search = function (query, filter, callback) {
  var procedures = []
  query = query.toLowerCase()
  let prefix = 'http://www.semanticweb.org/european_union#'

  var sparqlQuery = 'select ?id_str ?title_str ?status_str ?type where \
  {?p rdf:type ?type; dc:identifier ?i; dc:title ?t; eu:status ?s. \
    ?type rdfs:subClassOf ?x. ?x rdfs:subClassOf eu:Procedure. \
    BIND (STR(?i) AS ?id_str).BIND (STR(?t) AS ?title_str). BIND (STR(?s) AS ?status_str).'

  if (query.length > 0) { //filtro query testuale (titolo)
    sparqlQuery += 'FILTER contains(lcase(?t),"' + query + '").'
  }
  if (filter.status != null) { // filtro status
    sparqlQuery += 'FILTER regex(?s, "' + filter.status + '").'
  }
  if (filter.type != null) { // filtro type
    sparqlQuery += 'FILTER regex(?type, "' + prefix + filter.type + '").'
  }
  if (filter.id != null) { //filtro query testuale (id)
    sparqlQuery += 'FILTER regex(?id_str, "' + filter.id + '").'
  }

  sparqlQuery += '}'

  driver.query(sparqlQuery)
    .then((results) => {
      results.results.bindings.forEach(function (proc) {
        let procedure = { 'id': proc.id_str.value, 'title': proc.title_str.value }
        procedures.push(procedure)
      })
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
    .then(() => {
      callback(200, JSON.stringify(procedures))
    })
}

/**
 * PROCEDURE
 * ritorna dettagli della procedura identificata da id
 * esegue diverse sottoquery alle quali cassa il controllo sul flusso di dati (callback)
 * @param {*} id identificativo della Procedure da ricercare 
*/
exports.getProcedure = function (id, callback) {
  driver.query('select ?id_str ?title_str ?status_str ?type where \
  {?p rdf:type ?type; dc:identifier ?i; dc:title ?t; eu:status ?s. \
    ?type rdfs:subClassOf ?x. ?x rdfs:subClassOf eu:Procedure. \
    BIND (STR(?i) AS ?id_str).BIND (STR(?t) AS ?title_str). \
    BIND (STR(?s) AS ?status_str).FILTER regex(?i, "' + id + '")}  ')
    .then((results) => {
      if (results.results.bindings.length == 0) {
        return callback(500, '{"status":"danger","msg":"procedure not found"}')
      }

      proc = results.results.bindings[0]
      let type = proc.type.value.split("#")[1]
      let procedure = { 'id': proc.id_str.value, 'title': proc.title_str.value, 'status': proc.status_str.value, 'type': type }

      getDocuments(id, procedure, callback)
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
}

/**
 * DOCUMENTS
 * aggiunge a procedure i dettagli sui documenti e autori
 * ritorna il risultato richiamando la callback
 * @param {*} id identificativo della Procedure di cui si vogliono cercare i Documents
 * @param {*} procedure istanza di Procedure, di cui verrà impostato il campo "documents" con il risultato della ricerca
*/
function getDocuments(id, procedure, callback) {
  var documents = []
  procedure.documents = []
  driver.query('select ?date_str ?status_str ?url_str ?c ?name ?surname ?option_str ?type where {?p eu:hasDocument ?doc; \
    dc:identifier ?i.\
    ?doc eu:status ?s;\
    dc:date ?d;\
    eu:documentUrl ?u;\
    rdf:type ?type;\
    dcterms:creator ?c.\
    ?c foaf:name ?first;\
    foaf:surname ?last.\
    OPTIONAL { ?c eu:portfolio ?option }\
    OPTIONAL { ?c eu:belongsToGroup ?opt. ?opt rdfs:label ?option }\
    ?type rdfs:subClassOf eu:Document.\
    BIND (STR(?s) AS ?status_str).\
    BIND (STR(?d) AS ?date_str).\
    BIND (STR(?u) AS ?url_str)\
    BIND (STR(?first) AS ?name)\
    BIND (STR(?last) AS ?surname)\
    BIND (STR(?option) AS ?option_str)\
    FILTER regex(?i, "' + id + '"). } ')
    .then((results) => {
      results.results.bindings.forEach(function (doc) {
        let type = doc.type.value.split("#")[1]
        let uri = doc.c.value.split("#")[1]
        let author = {}
        if (doc.option_str) { // se ci sono campi optionali (cioè l'autore è un MEP o commissario)
          author = { 'uri': uri, 'name': doc.name.value + ' ' + doc.surname.value, 'details': doc.option_str.value }
        }
        let document = { 'date': doc.date_str.value, 'status': doc.status_str.value, 'url': doc.url_str.value, 'author': author, 'type': type }
        documents.push(document)
      })

      procedure.documents = documents
      json = '{"procedure": ' + JSON.stringify(procedure) + '}'

      callback(200, json)
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
}

/**
 * MEP
 * ricava i dettagli di un MEP
 * passa il controllo del flusso ad un'altra funzione che integra i dati
 * se l'individuo non è un MEP ritorna messaggio di errore
 * @param {*} id identificativo del MEP di cui cercare i dettagli delle informazioni
 */
exports.getMEP = function (id, callback) {
  driver.query('select ?first_str ?last_str ?group_str ?nation_str ?party_str ?homepage_str ?photo_str \
    where {<http://www.semanticweb.org/european_union#'+ id + '> foaf:name ?f;\
    foaf:surname ?l;\
    eu:belongsToGroup ?g;\
    eu:belongsToNationalParty ?p;\
    eu:homepage ?home;\
    eu:photo ?photo;\
    eu:cameFrom ?n.\
    ?g rdfs:label ?group.\
    ?n rdfs:label ?nation.\
    ?p rdfs:label ?party.\
    BIND (STR(?f) AS ?first_str).\
    BIND (STR(?l) AS ?last_str).\
    BIND (STR(?group) AS ?group_str).\
    BIND (STR(?nation) AS ?nation_str).\
    BIND (STR(?party) AS ?party_str).\
    BIND (STR(?home) AS ?homepage_str).\
    BIND (STR(?photo) AS ?photo_str).}')
    .then((results) => {
      if (results.results.bindings.length == 0) {
        return callback(500, '{"status":"warning","msg":"MEP not found"}')
      }

      res = results.results.bindings[0]
      let mep = { 'id': id, 'name': res.first_str.value, 'surname': res.last_str.value, 'group': res.group_str.value, 'nation': res.nation_str.value, 'party': res.party_str.value, 'homepage': res.homepage_str.value, 'photo': res.photo_str.value }

      getMembership(mep, callback)
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
}

/**
 * MEMBERSHIP
 * ricava l'elenco di commissioni alle quali il mep prende parte
 * ritorna il controllo del flusso al controller principale
 * @param {*} mep istanza di MEP di cui si cerca l'insieme di
 */
function getMembership(mep, callback) {
  membership = []
  driver.query('select ?acronym ?text\
  where {<http://www.semanticweb.org/european_union#' + mep.id + '> eu:memberOfCommittee ?c.\
  ?c rdfs:label ?t;\
  skos:altLabel ?a.\
  BIND (STR(?a) AS ?acronym).\
  BIND (STR(?t) AS ?text).}')
    .then((results) => {
      results.results.bindings.forEach(function (memb) {
        let member = { 'acronym': memb.acronym.value, 'text': memb.text.value }
        membership.push(member)
      })

      mep.membership = membership
      let json = '{"mep":' + JSON.stringify(mep) + '}'

      callback(200, json)
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
}

/**
 * COUNTRY
 * ritorna i dettagli di una nazione identificata da id
 * se non esiste ritorna messaggio di errore
 * @param {*} id string identificativa della Nazione da cercare, ergo il suo nome.
 */
exports.getCountry = function (id, callback) {
  driverDBpedia.query('SELECT ?img ?ab WHERE { \
    dbp:' + id + ' dbo:thumbnail ?img; \
    dbo:abstract ?ab\
    FILTER (lang(?ab) = "en")}')
    .then((results) => {
      if (results.results.bindings.length == 0) {
        return callback(500, '{"status":"danger","msg":"country not found"}')
      }

      c = results.results.bindings[0]
      let country = { "flag": c.img.value, "abstract": c.ab.value }
      let json = '{"country":' + JSON.stringify(country) + '}'

      callback(200, json)
    })
    .catch((err) => {
      return callback(500, '{"status":"danger","msg":"' + err.message + '"}')
    })
}