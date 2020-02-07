var express = require('express')
var app = express()
var dao = require('./dao.js')
const { Client } = require('virtuoso-sparql-client');

app.use(express.static('../web'))

dao.init()


function onQueryPerformed(res) {
  return (status, json) => { res.status(status).send(json) }
}

process.on('SIGTERM', () => {
  console.log('shutdown...')
  dao.close()
});

app.listen(8080, () => console.log('Server is running'))

function showError(res, status, msg) {
  res.type('application/json')
  res.status(status).send('{"status":"danger", "msg":"' + msg + '"}')
}

/**
 * API endpoint used to search for Procedures filtering them according to parameters 
 * @param {*} req HTTP GET request parameters
 */
app.get('/search', function (req, res) {
  var query = req.query.query

  // sanitize
  var mapping = {
    "Ordinary": "OrdinaryProcedure",
    "Special": "SpecialProcedure",
    "Budgetary": "BudgetaryProcedure",
    "Adopted": "Adopted",
    "Proposal": "Proposal",
    "First": "FirstLecture",
    "Second": "SecondLecture",
    "Third": "ThirdLecture",
    "Rejected": "Rejected",
  }

  var type = null
  if (mapping.hasOwnProperty(req.query.type)) {
    type = mapping[req.query.type]
  }
  var status = null
  if (mapping.hasOwnProperty(req.query.status)) {
    status = mapping[req.query.status]
  }

  var filter = { 'type': type, 'status': status }

  // regex id procedura
  if (/^[A-Z]{3}[0-9]{4}\/[0-9]+$/.test(query)) { // se ricerca tramite id
    filter.id = query
    query = ''
  }

  res.type('application/json')
  dao.search(query, filter, onQueryPerformed(res))
})

/**
 * API endpoint used to search for a specific Procedure using its ID.
 * @param {*} req HTTP GET request parameters
 */
app.get('/procedure/:id', function (req, res) {
  let id = req.params['id']
  id = id.replace('-', '/')

  // regex id procedura
  if (!id || !id.match(/^[A-Z]{3}[0-9]{4}\/[0-9]+$/)) {
    return showError(res, 400, 'Invalid procedure id')
  }

  res.type('application/json')
  dao.getProcedure(id, onQueryPerformed(res))
})

/**
 * API endpoint used to search for a specific MEP using its ID
 * @param {*} req HTTP GET request parameters
 */
app.get('/mep/:id', function (req, res) {
  let id = req.params['id']

  if (!id || !id.match(/^PERSON_.*$/)) {
    return showError(res, 400, 'Invalid MEP id')
  }

  id = id.split(' ').join('%20');

  res.type('application/json')
  dao.getMEP(id, onQueryPerformed(res))
})

/**
 * API endpoint used to search for additional Country informations using its name.
 * @param {*} req HTTP GET request parameters
 */
app.get('/country/:name', function (req, res) {
  let name = req.params['name']

  if (!name || !name.match(/^[A-Z][\w]+$/)) {
    return showError(res, 400, 'Invalid country name')
  }

  res.type('application/json')
  dao.getCountry(name, onQueryPerformed(res))
})
