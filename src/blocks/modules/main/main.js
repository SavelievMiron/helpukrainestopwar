import Splide from '@splidejs/splide';
import PhotoSwipe from "photoswipe";
import PhotoSwipeUI_Default from 'photoswipe/dist/photoswipe-ui-default';
import ClipboardJS from 'clipboard';

function reveal() {
    var reveals = document.querySelectorAll(".reveal");

    for (var i = 0; i < reveals.length; i++) {
        var windowHeight = window.innerHeight;
        var elementTop = reveals[i].getBoundingClientRect().top;
        var elementVisible = 150;

        if (elementTop < windowHeight - elementVisible) {
            reveals[i].classList.add("active");
        } else {
            reveals[i].classList.remove("active");
        }
    }
}
window.addEventListener("scroll", reveal);

function WebpIsSupported(callback){
    // If the browser doesn't has the method createImageBitmap, you can't display webp format
    if(!window.createImageBitmap){
        callback(false);
        return;
    }

    // Base64 representation of a white point image
    var webpdata = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAEAAQAcJaQAA3AA/v3AgAA=';

    // Retrieve the Image in Blob Format
    fetch(webpdata).then(function(response){
        return response.blob();
    }).then(function(blob){
        // If the createImageBitmap method succeeds, return true, otherwise false
        createImageBitmap(blob).then(function(){
            callback(true);
        }, function(){
            callback(false);
        });
    });
}
// You can run your code like
WebpIsSupported(function(isSupported){
    if(isSupported){
        console.log("Supported");
        // Get images with fallback option
        let fallbackImgs = document.querySelectorAll('img[data-fallback-lazy]')

        // Fallback each image
        for (let img of fallbackImgs) {
            let fallbackPath = img.getAttribute("data-fallback-lazy")
            console.log(fallbackPath)
            if (fallbackPath) {  // Ensure fallbackPath isn't null
                img.setAttribute("data-splide-lazy", fallbackPath)
            }
        }
    }else{
        console.log("Not supported");
    }
});

const mainSlider = new Splide( '.hero-slider', {
    type: 'loop',
    speed: 800,
    pagination: true,
    arrows: false,
    autoplay: true,
    interval: 10000,
    wheel: false,
    keyboard: true,
    lazyLoad: true
} ).mount();

const problemSlider = new Splide('.problem-slider', {
    type: 'loop',
    speed: 800,
    pagination: true,
    wheel: false,
    keyboard: true,
    lazyLoad: true
}).mount();

const stepsSlider = new Splide('.steps-slider', {
    speed: 800,
    perPage: 3,
    perMove: 1,
    fixedWidth: '250px',
    gap: '35px',
    pagination: false,
    wheel: false,
    keyboard: true,
    lazyLoad: true
}).mount();

var initPhotoSwipeFromDOM = function(gallerySelector) {

    // parse slide data (url, title, size ...) from DOM elements 
    // (children of gallerySelector)
    var parseThumbnailElements = function(el) {
        var thumbElements = el.childNodes,
            numNodes = thumbElements.length,
            items = [],
            figureEl,
            linkEl,
            size,
            item;

        for(var i = 0; i < numNodes; i++) {

            figureEl = thumbElements[i]; // <figure> element
            console.log(figureEl)
            if (
                figureEl.nodeType == Node.TEXT_NODE || 
                !figureEl.classList.contains('gallery__image')
            ) {
                continue;
            }

            // include only element nodes 
            if(figureEl.nodeType !== 1) {
                continue;
            }

            linkEl = figureEl.children[0]; // <a> element

            size = linkEl.getAttribute('data-size').split('x');

            // create slide object
            item = {
                src: linkEl.getAttribute('href'),
                w: parseInt(size[0], 10),
                h: parseInt(size[1], 10)
            };



            if(figureEl.children.length > 1) {
                // <figcaption> content
                item.title = figureEl.children[1].innerHTML; 
            }

            if(linkEl.children.length > 0) {
                // <img> thumbnail element, retrieving thumbnail url
                item.msrc = linkEl.children[0].getAttribute('src');
            } 

            item.el = figureEl; // save link to element for getThumbBoundsFn
            items.push(item);
        }

        return items;
    };

    // find nearest parent element
    var closest = function closest(el, fn) {
        return el && ( fn(el) ? el : closest(el.parentNode, fn) );
    };

    // triggers when user clicks on thumbnail
    var onThumbnailsClick = function(e) {
        e = e || window.event;
        e.preventDefault ? e.preventDefault() : e.returnValue = false;

        var eTarget = e.target || e.srcElement;

        // find root element of slide
        var clickedListItem = closest(eTarget, function(el) {
            return (el.tagName && el.tagName.toUpperCase() === 'FIGURE');
        });

        if(!clickedListItem) {
            return;
        }

        // find index of clicked item by looping through all child nodes
        // alternatively, you may define index via data- attribute
        var clickedGallery = clickedListItem.parentNode,
            childNodes = clickedListItem.parentNode.childNodes,
            numChildNodes = childNodes.length,
            nodeIndex = 0,
            index;

        for (var i = 0; i < numChildNodes; i++) {
            if(childNodes[i].nodeType !== 1) { 
                continue; 
            }

            if(childNodes[i] === clickedListItem) {
                index = nodeIndex;
                break;
            }
            nodeIndex++;
        }

        if(index >= 0) {
            document.body.classList.add("stop-scrolling");

            // open PhotoSwipe if valid index found
            openPhotoSwipe( index, clickedGallery );
        }
        return false;
    };

    // parse picture index and gallery index from URL (#&pid=1&gid=2)
    var photoswipeParseHash = function() {
        var hash = window.location.hash.substring(1),
        params = {};

        if(hash.length < 5) {
            return params;
        }

        var vars = hash.split('&');
        for (var i = 0; i < vars.length; i++) {
            if(!vars[i]) {
                continue;
            }
            var pair = vars[i].split('=');  
            if(pair.length < 2) {
                continue;
            }           
            params[pair[0]] = pair[1];
        }

        if(params.gid) {
            params.gid = parseInt(params.gid, 10);
        }

        return params;
    };

    var openPhotoSwipe = function(index, galleryElement, disableAnimation, fromURL) {
        var pswpElement = document.querySelectorAll('.pswp')[0],
            gallery,
            options,
            items;

        items = parseThumbnailElements(galleryElement);

        // define options (if needed)
        options = {
            galleryUID: galleryElement.getAttribute('data-pswp-uid'),
            getThumbBoundsFn: function(index) {
                // See Options -> getThumbBoundsFn section of documentation for more info
                var thumbnail = items[index].el.getElementsByTagName('img')[0], // find thumbnail
                    pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
                    rect = thumbnail.getBoundingClientRect(); 

                return {x:rect.left, y:rect.top + pageYScroll, w:rect.width};
            }
        };

        // PhotoSwipe opened from URL
        if(fromURL) {
            if(options.galleryPIDs) {
                // parse real index when custom PIDs are used 
                // http://photoswipe.com/documentation/faq.html#custom-pid-in-url
                for(var j = 0; j < items.length; j++) {
                    if(items[j].pid == index) {
                        options.index = j;
                        break;
                    }
                }
            } else {
                // in URL indexes start from 1
                options.index = parseInt(index, 10) - 1;
            }
        } else {
            options.index = parseInt(index, 10);
        }

        // exit if index not found
        if( isNaN(options.index) ) {
            return;
        }

        if(disableAnimation) {
            options.showAnimationDuration = 0;
        }

        // Pass data to PhotoSwipe and initialize it
        gallery = new PhotoSwipe( pswpElement, PhotoSwipeUI_Default, items, options);
        gallery.init();
    };

    // loop through all gallery elements and bind events
    var galleryElements = document.querySelectorAll( gallerySelector );

    for(var i = 0, l = galleryElements.length; i < l; i++) {
        galleryElements[i].setAttribute('data-pswp-uid', i+1);
        galleryElements[i].onclick = onThumbnailsClick;
    }

    // Parse URL and open gallery if it contains #&pid=3&gid=1
    var hashData = photoswipeParseHash();
    if(hashData.pid && hashData.gid) {
        openPhotoSwipe( hashData.pid ,  galleryElements[ hashData.gid - 1 ], true, true );
    }
};
initPhotoSwipeFromDOM('.gallery');

// lightbox for video
const videoLightbox = document.getElementById('video-lightbox');
if (videoLightbox !== null) {
    const close = videoLightbox.querySelector('.video-lightbox__close'),
    videoTag = videoLightbox.querySelector('#video'),
    source = videoTag.querySelector('source');

    document.addEventListener('click', function(event) {        
        if (
            event.target.matches(".video-lightbox__close") ||
            event.target.matches(".video-lightbox__content")
        ) {
            hideVideoLightbox();
        }
    }, false)

    const videos = document.querySelectorAll('.video-play-btn');
    if (videos.length !== 0) {
        for (let i = 0; i < videos.length; ++i) {
            videos[i].addEventListener('click', function (e) {
                e.stopPropagation();

                const btn = e.target.closest('button'),
                url = btn.dataset.url;

                source.setAttribute('src', url);
                
                showVideoLightbox();
            })
        }
    }

    function showVideoLightbox() {
        document.body.classList.add("stop-scrolling");

        videoLightbox.classList.add('is-active');
        videoTag.load();
        videoTag.play();
    }

    function hideVideoLightbox() {
        document.body.classList.remove("stop-scrolling");

        videoLightbox.classList.remove('is-active');
        videoTag.pause();
    }
}

// lightbox for youtube video
const youtubeLightbox = document.getElementById('youtube-lightbox');
if (youtubeLightbox !== null) {
    const close = youtubeLightbox.querySelector('.youtube-lightbox__close'),
    iFrame = youtubeLightbox.querySelector('#player');

    document.addEventListener('click', function(event) {        
        if (
            event.target.matches(".youtube-lightbox__close") ||
            event.target.matches(".youtube-lightbox__content")
        ) {
            hideYoutubeLightbox();
        }
    }, false)

    const videos = document.querySelectorAll('.youtube-play-btn');
    if (videos.length !== 0) {
        for (let i = 0; i < videos.length; ++i) {
            videos[i].addEventListener('click', function (e) {
                e.stopPropagation();

                const btn = e.target.closest('button'),
                url = btn.dataset.url;

                iFrame.setAttribute('src', url);
                
                showYoutubeLightbox();
            })
        }
    }

    function showYoutubeLightbox() {
        document.body.classList.add("stop-scrolling");

        youtubeLightbox.classList.add('is-active');
    }

    function hideYoutubeLightbox() {
        document.body.classList.remove("stop-scrolling");

        youtubeLightbox.classList.remove('is-active');
        iFrame.setAttribute('src', '');
    }
}

const pswpCloseBtn = document.querySelector('.pswp__button--close');
if (pswpCloseBtn !== null) {
    pswpCloseBtn.addEventListener('click', function () {
        document.body.classList.remove("stop-scrolling");
    })
}

const copies = document.querySelectorAll('.copy');
if (copies.length !== 0) {
    const clipboard = new ClipboardJS(copies);
}

const modal = document.querySelector('.modal');
if (modal !== null) {
    const closeModal = modal.querySelector('.modal__close');
    closeModal.addEventListener('click', function (e) {
        modal.classList.remove('is-active')
    })

    modal.addEventListener('click', function (e) {
        if (e.target.classList.contains('modal')) {
            modal.classList.remove('is-active')
        }
    })
}

const requisiteBtn = document.getElementById('requisites-btn'),
requisitesModal = document.getElementById('requisites-modal');
if (requisiteBtn !== null) {
    requisiteBtn.addEventListener('click', function (e) {
        if (requisitesModal !== null) {
            requisitesModal.classList.add('is-active');
        }
    })
}
