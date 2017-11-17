var getTime = () => {
       var currentdate = new Date();
       var date = '[' + currentdate.getFullYear() + '/'
                + (currentdate.getMonth()+1) + '/'
                + currentdate.getDate() + " "
                + currentdate.getHours() + ":"
                + currentdate.getMinutes() + ":"
                + currentdate.getSeconds() + ']'
       return date
}

exports.timestampLog = (data) => {
        console.log(getTime() + ' ' + data)
}
