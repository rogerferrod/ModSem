class MEP(object):
    BASE_URL = "https://www.europarl.europa.eu/"
    BASE_URL_PHOTO = BASE_URL + "mepphoto/"
    BASE_URL_HOMEPAGE = BASE_URL + "meps/en/"
    PHOTO_FORMAT = ".jpg"

    def __init__(self, party_mapping):
        self.id = 0
        self.firstName = ""
        self.lastName = ""
        self.country = ""
        self.politicalgroup = ""
        self.nationalparty = ""
        self.urlHomepage = ""
        self.urlPhoto = ""
        self.party_mapping = party_mapping
        self.parliamentary_role = None

    def setId(self, id_mep):
        self.id = id_mep
        self.setUrlHomepage()
        self.setUrlPhoto()

    def setFullName(self, fullName):
        splits = fullName.split(' ')
        ls = len(splits) - 1
        # all surename's components are upper-cases
        self.lastName = ""
        while ls >= 0 and splits[ls].isupper():
            self.lastName = splits[ls] + " " + self.lastName
            self.lastName = self.lastName.strip()
            ls -= 1
        self.firstName = ""
        while ls >= 0:
            self.firstName = splits[ls] + " " + self.firstName
            self.firstName = self.firstName.strip()
            ls -= 1

    def setCountry(self, country):
        self.country = country

    def setPoliticalgroup(self, politicalgroup):
        self.politicalgroup = self.party_mapping[politicalgroup]

    def setNationalpoliticalgroup(self, nationalpoliticalgroup):
        if nationalpoliticalgroup == 'Independent' or nationalpoliticalgroup == 'Indépendant' or nationalpoliticalgroup == 'Independiente':
            nationalpoliticalgroup = None
        elif nationalpoliticalgroup == '' or nationalpoliticalgroup == '-':
            nationalpoliticalgroup = None
        self.nationalparty = nationalpoliticalgroup

    def setUrlHomepage(self):
        self.urlHomepage = MEP.BASE_URL_HOMEPAGE + str(self.id)

    def setUrlPhoto(self):
        self.urlPhoto = MEP.BASE_URL_PHOTO + str(self.id) + MEP.PHOTO_FORMAT

    def __str__(self):
        return "id: " + str(
            self.id) + ", firstName: " + self.firstName + ", lastName: " + self.lastName + ", country: " + self.country + ", politicalgroup: " + self.politicalgroup + ", nationalpoliticalgroup: " + self.nationalparty + ", urlHomepage: " + self.urlHomepage + ", urlPhoto: " + self.urlPhoto

    def toTupla(self):
        return (self.id, self.firstName, self.lastName, self.country, self.politicalgroup, self.nationalparty,
                self.urlHomepage, self.urlPhoto, self.parliamentary_role)
