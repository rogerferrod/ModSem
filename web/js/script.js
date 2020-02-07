$(function () {

  $('#search_form').on('click', 'button[type=submit]', e => {
    e.preventDefault();

    const form = document.getElementById('search_form');
    const query_str = form.elements['input_search'].value;

    let advSearchClasses = $('#advSearchBar').attr("class")
    let filter = {}
    if (advSearchClasses.includes('show')) {
      filter = {
        "type": $('#select_type').children("option:selected").val(),
        "status": $('#select_status').children("option:selected").val()
      }
    }

    search(query_str, filter);
  });

  $('#procedureResults').on("click", "tr", e => {
    e.preventDefault();

    var target = e.target;
    showProcedure(target);
  });
});

/**
 * Search for all procedures given an optional string (title or identifier) 
 * or a procedure type or a procedure status.
 * @param {*} query_str a string holding identifier or a part or a whole procedure title.
 * @param {*} filter a dictionary holding the optional filters over the procedure
 */
function search(query_str, filter) {
  let data = { query: query_str }
  if (filter.hasOwnProperty('type')) {
    data.type = filter.type
  }
  if (filter.hasOwnProperty('status')) {
    data.status = filter.status
  }

  $.ajax({
    url: "search",
    type: "get",
    data: data,
    dataType: 'json',
    success: data => {
      var allProcedures = [];
      if (!data.hasOwnProperty('procedures')) {
        showAlert('danger', 'data corrupted');
        allProcedures = data;
      } else {
        allProcedures = data.procedures;
      }

      const procList = $('#procedureResults');
      procList.empty();
      $('#resultsContainer').show();
      $('.alert').remove();
      procList.show();

      /**
       * Iterates over all the obtained procedures and creating, for each of them, a table row.
      */
      var i = 0;
      while (i < allProcedures.length) {
        let procedure = allProcedures[i];
        if (hasProperties(procedure, ['id', 'title'])) {
          procList.append('<tr id="' + procedure.id + '"><td>' + procedure.id + '</td><td>' + procedure.title + '</td></tr>')
        }
        i++;
      }
    },
    error: xhr => {
      let data = xhr.responseJSON;
      if (data == null || !hasProperties(data, ['status', 'msg'])) {
        showAlert('danger', 'data corrupted');
        return;
      }
      showAlert(data.status, data.msg);
    }
  });
}

/**
 * Show a panel with all details of a procedure, identified by the identifier held by the given DOM node.
 * An asynchronous API call is performed to retrieve the informations.
 * @param {*} target a DOM node holding the Procedure ID
 */
function showProcedure(target) {
  if (target.nodeName == 'TD') {
    target = target.parentElement
  }

  var id = target.id;
  id = id.replace('/', '-')  //IMPORTANTE

  $.ajax({
    url: "procedure/" + id,
    type: "get",
    success: data => {
      if (!data.hasOwnProperty('procedure')) {
        showAlert('danger', 'data corrupted');
        return;
      }

      $('.alert').remove();
      let procedure = data.procedure;
      if (!hasProperties(procedure, ['id', 'title', 'status', 'type', 'documents'])) {
        showAlert('danger', 'data corrupted');
        return;
      }

      $('#article_id').text(id);
      $('#title').text(procedure.title);
      $('#cover_title').text(procedure.id);
      $('#header_title').text(procedure.title);
      $('#proc_status').text(procedure.status);
      $('#proc_type').text(procedure.type);
      $('#documents tr').remove();

      var allDocs = procedure.documents;
      if (allDocs !== undefined) {
        showDocuments(allDocs);
      }

      $('#article_card').show();
      $('#mep_card').hide();
    },
    error: function (xhr) {
      let data = xhr.responseJSON;
      if (data == null || !hasProperties(data, ['status', 'msg'])) {
        showAlert('danger', 'data corrupted');
        return;
      }
      showAlert(data.status, data.msg);
    }
  });
}

/**
 * Show all Documents contained in the given array.
 * Those Documents are presented as table rows.
 * @param {*} allDocs array of Documents to be shown
*/
function showDocuments(allDocs) {
  $('#documents tr').remove();
  var docTRBodyContainer = $('#documents');
  docTRBodyContainer.show();
  for (var i in allDocs) {
    let doc = allDocs[i];

    component = '<tr><td>' + doc.date
      + '</td><td>' + doc.status +
      '</td><td><a target="_blank" href="' + doc.url + '" class="fa fa-file" aria-hidden="true">'
      + '</a>' + '</td><td>'

    if (hasProperties(doc.author, ['name', 'details', 'uri'])) {
      let name = doc.author.name
      let details = doc.author.details
      let uri = doc.author.uri
      component += '<span class="btn" id="' + uri + '" onClick="showMEP(this)">' + name + ' <b>(' + details + ')</b></span>'
    }

    component += '</td><td>' + doc.type + '</td></tr>'
    docTRBodyContainer.append(component)
  }
}

/**
 * Show a panel with all details of a MEP (Member of European Parliament), identified by the
 * identifier held by the given DOM node.
 * An asynchronous API call is performed to retrieve the informations.
 * @param {*} target a DOM node holding the MEP ID
 */
function showMEP(target) {
  let id = target.id
  $.ajax({
    url: "mep/" + id,
    type: "get",
    success: data => {
      if (!data.hasOwnProperty('mep')) {
        showAlert('danger', 'data corrupted');
        return;
      }
      var mep = data.mep;

      $('#article_card').hide();
      $('#mep_card').show();

      /**
       * Update the GUI with the informations
       */
      var mepdPhoto = $('#mepdPhoto'), mepdFirstName = $('#mepdFirstName'),
        mepdNationalParty = $('#mepdNationalParty'),
        mepdHomepage = $('#mepdHomepage');
      mepdPhoto.attr('src', mep.photo);
      mepdFirstName.text(mep.name + ' ' + mep.surname);
      mepdNationalParty.text(mep.party);
      mepdNationalParty.append(' (<span class="btn" onCLick="showCountry(this)" id="' + mep.nation + '" data-toggle="modal" data-target="#modalCountry">' + mep.nation + '</span>)')
      mepdHomepage.text("HOMEPAGE at: " + mep.homepage.substring(0, mep.homepage.indexOf('/', 10)));
      mepdHomepage.attr('href', mep.homepage);
      var mepMemberOfBody = $('#mepMemberOfBody');
      mepMemberOfBody.empty();

      /**
       * Append in a table the MEP memberships
      */
      for (var i in mep.membership) {
        var m = mep.membership[i];
        mepMemberOfBody.append('<tr><td>' + m.acronym + '</td><td>' + m.text + '</td>tr>');
      }
    },
    error: function (xhr) {
      let data = xhr.responseJSON;
      if (data == null || !hasProperties(data, ['status', 'msg'])) {
        showAlert('danger', 'data corrupted');
        return;
      }
      showAlert(data.status, data.msg);
    }
  });
}

/**
 * Load nation flag and description retrieved from Wikipedia (through DBpedia).
 * The Nation is identified by an ID, held by the given DOM node.
 * An asynchronous API call is performed to retrieve the informations.
 * @param {*} target a DOM node holding the Procedure ID
 */
function showCountry(target) {
  let id = target.id

  $.ajax({
    url: "country/" + id,
    type: "get",
    success: data => {
      var countryDescriptionTooltip = $('#countryDescriptionTooltip');
      var imgCountryFlag = $('#imgCountryFlag');
      var flagName = $('#flagName');
      countryDescriptionTooltip.text(data.country.abstract)
      imgCountryFlag.attr("src", data.country.flag);
      flagName.text(id);
    },
    error: function (xhr) {
      let data = xhr.responseJSON;
      if (data == null || !hasProperties(data, ['status', 'msg'])) {
        showAlert('danger', 'data corrupted');
        return;
      }
      showAlert(data.status, data.msg);
    }
  });
}

//utilities

function showAlert(status, msg) {
  $('.alert-' + status).remove();
  let html = '<div class="alert alert-' + status + '" role="alert">' + msg + '</div>';
  $('main').prepend(html);
}

function hasProperties(item, array) {
  let ret = true;
  for (let i = 0; ret && i < array.length; i++) {
    ret &= item.hasOwnProperty(array[i]);
  }
  return ret;
}


